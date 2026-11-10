/* ==========================================================================
   Swellcome — mini-jeu « Vous y allez ou pas ? » (page Comprendre le forecast)
   Conditions fictives. La bonne réponse est calculée par verdict.js,
   avec les mêmes règles que les fiches spots.
   1. Situations
   2. Déroulement de la partie
   3. Animation de la mer
   ========================================================================== */

(function () {
  const racine = document.getElementById("jeu-forecast");
  if (!racine || !window.SwellcomeVerdict) return;

  const V = window.SwellcomeVerdict;
  const { VERDICTS, LIBELLE_VENT } = V;


  /* 1. Situations : plage imaginaire orientée ouest, qui sature à 3 m comme en Gironde.
     Vent de terre = vent d'est (90°). Les chiffres affichés sont ceux du large. */

  const ORIENTATION = 270;
  const SATURATION = 3;
  const EST = 90, OUEST = 270, SUD = 180, SUD_OUEST = 225;
  const MANCHES = 8;
  const NIVEAUX = Object.fromEntries(
    Object.entries(V.NIVEAUX).map(([cle, niveau]) => [cle, V.pourSpot(niveau, SATURATION)])
  );
  const CARDINAL = { [OUEST]: "ouest", [SUD_OUEST]: "sud-ouest" };

  const SITUATIONS = [
    { niveau: "debutant", houle: 1, periode: 10, dirHoule: OUEST, vent: 8, dir: EST, lecon: "Une houle de face bien rangée et peu de vent : les meilleures conditions pour progresser." },
    { niveau: "debutant", houle: 1.8, periode: 10, dirHoule: OUEST, vent: 8, dir: EST, lecon: "Une très belle journée, mais pour d'autres : même par vent parfait, c'est trop gros pour débuter." },
    { niveau: "debutant", houle: 1, periode: 9, dirHoule: OUEST, vent: 17, dir: OUEST, lecon: "La taille est bonne, mais le vent commence à gêner. Faisable, moins confortable." },
    { niveau: "debutant", houle: 1.2, periode: 6, dirHoule: OUEST, vent: 28, dir: OUEST, lecon: "Une houle courte qui n'arrive pas à grand-chose, et un fort vent de mer par-dessus : l'eau sera brouillonne et fatigante." },
    { niveau: "debutant", houle: 0.8, periode: 5, dirHoule: SUD_OUEST, vent: 8, dir: EST, lecon: "Houle de sud-ouest et période de 5 s : sur une plage orientée ouest, il n'arrive presque rien au bord." },
    { niveau: "intermediaire", houle: 1.5, periode: 11, dirHoule: OUEST, vent: 10, dir: EST, lecon: "Taille dans la zone, houle bien rangée, vent de terre léger : on y va." },
    { niveau: "intermediaire", houle: 2, periode: 7, dirHoule: OUEST, vent: 10, dir: EST, lecon: "2 m annoncés à 7 s, c'est à peine plus d'un mètre au bord, et des vagues sans grande force." },
    { niveau: "intermediaire", houle: 1.4, periode: 10, dirHoule: OUEST, vent: 30, dir: OUEST, lecon: "La houle est bonne, mais le vent de mer l'écrase. Regarde toujours le vent après la houle." },
    { niveau: "intermediaire", houle: 1.6, periode: 9, dirHoule: OUEST, vent: 18, dir: SUD, lecon: "Le vent de travers reste acceptable s'il n'est pas trop fort, mais il abîme la vague." },
    { niveau: "intermediaire", houle: 1.2, periode: 5, dirHoule: OUEST, vent: 8, dir: EST, lecon: "Mer calme ne veut pas dire bonnes vagues : à 5 secondes, 1,2 m au large ne donne presque rien au bord." },
    { niveau: "intermediaire", houle: 0.8, periode: 10, dirHoule: OUEST, vent: 6, dir: EST, lecon: "Un peu petit pour ce niveau, mais propre : de quoi s'amuser avec une planche adaptée." },
    { niveau: "confirme", houle: 2, periode: 13, dirHoule: OUEST, vent: 12, dir: EST, lecon: "Houle longue, taille solide et vent de terre : le créneau à ne pas rater." },
    { niveau: "confirme", houle: 3.2, periode: 14, dirHoule: OUEST, vent: 10, dir: EST, lecon: "À partir de 3 m, les bancs saturent : ça ferme partout et il devient quasi impossible de sortir, même avec un vent parfait." },
    { niveau: "confirme", houle: 2.2, periode: 9, dirHoule: OUEST, vent: 8, dir: EST, lecon: "La taille est là, mais la période reste un peu courte pour ce niveau : surfable sans être idéal." },
    { niveau: "confirme", houle: 1.7, periode: 12, dirHoule: OUEST, vent: 25, dir: EST, lecon: "Un vent fort n'est pas forcément un problème : venu de la terre, il lisse et creuse la vague." },
    { niveau: "expert", houle: 2, periode: 14, dirHoule: OUEST, vent: 15, dir: EST, lecon: "2 m à 14 s, c'est plus gros au bord qu'au large : exactement ce que ce niveau recherche." },
    { niveau: "expert", houle: 2.2, periode: 14, dirHoule: OUEST, vent: 15, dir: EST, lecon: "Ça commence à faire beaucoup : on approche de la saturation, le passage de la barre devient dur." },
    { niveau: "expert", houle: 3, periode: 15, dirHoule: OUEST, vent: 15, dir: EST, lecon: "Même pour un expert, 3 m sur ces beach breaks, c'est saturé : les vagues ferment et sortir devient quasi impossible." },
    { niveau: "expert", houle: 1.9, periode: 14, dirHoule: OUEST, vent: 20, dir: SUD, lecon: "Même avec une belle houle, un vent de travers de 20 km/h déforme les grosses vagues." },
    { niveau: "expert", houle: 2.2, periode: 11, dirHoule: OUEST, vent: 15, dir: EST, lecon: "Belle taille et bon vent, mais la période reste juste pour ce niveau." },
    { niveau: "expert", houle: 1, periode: 13, dirHoule: OUEST, vent: 10, dir: EST, lecon: "Propre mais bien trop petit pour ce niveau : autant laisser la place aux autres." },
  ].map((s) => {
    const type = V.typeVent(s.dir, ORIENTATION);
    const taille = V.tailleAuBord([{ hauteur: s.houle, periode: s.periode, direction: s.dirHoule }], ORIENTATION);
    return {
      ...s,
      type,
      taille,
      resultat: V.evaluer({ hauteur: taille, houle: s.houle, periode: s.periode, vent: s.vent, type }, NIVEAUX[s.niveau]),
    };
  });

  // Pour tester les règles depuis la console
  racine.situations = SITUATIONS;

  const melanger = (liste) => {
    const copie = [...liste];
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  };

  // Un mélange équilibré : 3 « À oublier », 3 « Correct », 2 « Top »
  function tirerPartie() {
    const prendre = (note, nombre) => melanger(SITUATIONS.filter((s) => s.resultat.note === note)).slice(0, nombre);
    return melanger([...prendre(0, 3), ...prendre(1, 3), ...prendre(2, 2)]);
  }

  const nombre = (x, decimales = 1) => x.toLocaleString("fr-FR", { maximumFractionDigits: decimales });
  const icone = (nom) => `<svg class="icon" aria-hidden="true"><use href="#${nom}"></use></svg>`;


  /* 2. Déroulement de la partie */

  let partie = tirerPartie();
  let rang = 0;
  let score = 0;
  let serie = 0;

  function repereNiveau(niveau) {
    const hauteur = Number.isFinite(niveau.max) ? `${nombre(niveau.min)} à ${nombre(niveau.max)} m` : `${nombre(niveau.min)} m et plus`;
    const periode = niveau.periode ? `${niveau.periode} s et plus` : "période peu importante";
    const vent = { faible: "vent faible", "terre-ou-faible": "vent de terre ou faible", terre: "vent de terre" }[niveau.vent];
    return `${hauteur} · ${periode} · ${vent}`;
  }

  function afficherManche() {
    const s = partie[rang];
    const niveau = NIVEAUX[s.niveau];

    racine.innerHTML = `
      <div class="jeu-tete">
        <span>Manche <strong>${rang + 1}</strong> sur ${MANCHES}</span>
        <span>Score <strong>${score}</strong>${serie > 1 ? ` · Série de ${serie}` : ""}</span>
      </div>
      <div class="jeu-progression" aria-hidden="true"><i style="width:${rang / MANCHES * 100}%"></i></div>

      <div class="jeu-scene">
        <svg viewBox="0 0 640 240" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
          <rect class="s-ciel" width="640" height="240"/>
          <circle class="s-soleil" cx="430" cy="48" r="24"/>
          <g class="s-vents"></g>
          <path class="s-mer-fond"/>
          <path class="s-mer"/>
          <path class="s-ecume"/>
          <path class="s-plage" d="M500,240 L500,172 C540,166 590,152 640,146 L640,240 Z"/>
          <g class="s-surfeur">
            <rect x="584" y="86" width="9" height="70" rx="4.5"/>
            <circle cx="565" cy="97" r="7"/>
            <path d="M565,106 L565,132 M565,112 L584,120 M565,112 L553,126 M565,132 L558,156 M565,132 L572,155"/>
          </g>
        </svg>
        <span class="jeu-etiquette jeu-etiquette--plage">Plage</span>
        <span class="jeu-etiquette jeu-etiquette--large">Le large</span>
      </div>

      <div class="stats jeu-chiffres">
        <div class="stat"><div class="stat-value">${nombre(s.houle)} <small>m</small></div><div class="stat-label">Houle au large</div></div>
        <div class="stat"><div class="stat-value">${nombre(s.periode)} <small>s</small></div><div class="stat-label">Période</div></div>
        <div class="stat"><div class="stat-value">${CARDINAL[s.dirHoule]}</div><div class="stat-label">Houle venant du…</div></div>
        <div class="stat"><div class="stat-value">${s.vent} <small>km/h</small></div><div class="stat-label">${LIBELLE_VENT[s.type]}</div></div>
      </div>

      <h3 class="jeu-question" tabindex="-1">Pour un niveau ${niveau.nom.toLowerCase()}, ce créneau est…</h3>
      <p class="jeu-repere">Repères du niveau, au bord : ${repereNiveau(niveau)}</p>

      <div class="jeu-choix" role="group" aria-label="Ta réponse">
        ${[2, 1, 0].map((n) => `
          <button type="button" class="jeu-bouton" data-note="${n}">
            ${icone(VERDICTS[n].icone)}<span>${VERDICTS[n].nom}</span>
          </button>`).join("")}
      </div>
      <div class="jeu-retour" aria-live="polite"></div>`;

    racine.querySelector(".jeu-choix").addEventListener("click", (evenement) => {
      const bouton = evenement.target.closest(".jeu-bouton");
      if (bouton) repondre(Number(bouton.dataset.note));
    });

    lancerMer(s);
  }

  const MOT_NOTE = { 2: "Bon", 1: "Limite", 0: "Mauvais" };

  function ligneCritere(note, texte) {
    return `<li><span class="badge badge--${VERDICTS[note].badge}">${MOT_NOTE[note]}</span><span>${texte}</span></li>`;
  }

  function repondre(reponse) {
    const s = partie[rang];
    const niveau = NIVEAUX[s.niveau];
    const juste = reponse === s.resultat.note;
    const { notes } = s.resultat;

    score += juste ? 1 : 0;
    serie = juste ? serie + 1 : 0;

    racine.querySelectorAll(".jeu-bouton").forEach((bouton) => {
      const note = Number(bouton.dataset.note);
      bouton.disabled = true;
      if (note === s.resultat.note) {
        bouton.classList.add("is-juste");
        bouton.insertAdjacentHTML("beforeend", "<small>Bonne réponse</small>");
      } else if (note === reponse) {
        bouton.classList.add("is-faux");
        bouton.insertAdjacentHTML("beforeend", "<small>Ton choix</small>");
      }
    });

    const zone = Number.isFinite(niveau.max) ? `${nombre(niveau.min)} à ${nombre(niveau.max)} m` : `${nombre(niveau.min)} m et plus`;
    const textePeriode = niveau.periode
      ? `Période de ${nombre(s.periode)} s, il faut ${niveau.periode} s ou plus`
      : `Période de ${nombre(s.periode)} s, peu importante à ce niveau`;

    const retour = racine.querySelector(".jeu-retour");
    const derniere = rang === MANCHES - 1;
    retour.innerHTML = `
      <div class="jeu-explication">
        <p class="jeu-resultat">${juste ? "Bien vu !" : `Raté : c'était « ${VERDICTS[s.resultat.note].nom} ».`}</p>
        <p>${s.lecon}</p>
        <ul class="jeu-criteres">
          ${ligneCritere(notes.hauteur, s.resultat.sature
            ? `Houle de ${nombre(s.houle)} m : à partir de ${SATURATION} m, les bancs saturent`
            : `Environ ${nombre(s.taille)} m au bord, zone idéale ${zone}`)}
          ${ligneCritere(notes.periode, textePeriode)}
          ${ligneCritere(notes.vent, `${LIBELLE_VENT[s.type]} à ${s.vent} km/h`)}
        </ul>
        <p class="jeu-regle">Le verdict suit toujours le critère le plus faible.</p>
        <button type="button" class="btn jeu-suivant">
          ${derniere ? "Voir mon résultat" : "Manche suivante"}
          ${icone("i-arrow-right").replace('class="icon"', 'class="icon icon--fleche"')}
        </button>
      </div>`;

    const suivant = retour.querySelector(".jeu-suivant");
    suivant.addEventListener("click", () => {
      rang += 1;
      if (rang < MANCHES) {
        afficherManche();
        racine.querySelector(".jeu-question").focus({ preventScroll: true });
        racine.scrollIntoView({ block: "nearest" });
      } else {
        afficherFin();
      }
    });
    suivant.focus({ preventScroll: true });
    retour.scrollIntoView({ block: "nearest" });
  }

  function titreFinal() {
    if (score === MANCHES) return ["Sans-faute", "Tu lis un forecast comme un local."];
    if (score >= 6) return ["Œil de local", "Tu sais repérer les bons créneaux. Encore quelques réglages sur le vent et la période."];
    if (score >= 4) return ["Bien placé au pic", "Les bases sont là. Relis la partie sur le vent : c'est souvent elle qui fait la différence."];
    return ["Encore quelques vagues à prendre", "Pas de panique, ça s'apprend. Relis le guide au-dessus et retente une partie."];
  }

  function afficherFin() {
    arreterMer();
    const [titre, message] = titreFinal();
    racine.innerHTML = `
      <div class="jeu-fin">
        <span class="eyebrow">Résultat</span>
        <p class="jeu-score" tabindex="-1">${score} <small>sur ${MANCHES}</small></p>
        <h3>${titre}</h3>
        <p>${message}</p>
        <div class="hero-actions">
          <button type="button" class="btn jeu-rejouer">Rejouer</button>
          <a class="btn btn--secondary" href="${racine.dataset.spots}">Voir les vraies prévisions</a>
        </div>
      </div>`;
    racine.querySelector(".jeu-rejouer").addEventListener("click", () => {
      partie = tirerPartie();
      rang = 0;
      score = 0;
      serie = 0;
      afficherManche();
      racine.querySelector(".jeu-question").focus({ preventScroll: true });
    });
    racine.querySelector(".jeu-score").focus({ preventScroll: true });
    racine.scrollIntoView({ block: "nearest" });
  }


  /* 3. Animation de la mer : la hauteur, la période et le vent changent vraiment l'image */

  const ligneMer = 168;
  const finMer = 505;
  const metre = 40;           // pixels pour 1 m : le surfeur de la scène mesure environ 1,75 m
  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let idAnimation = null;
  let visible = true;
  let dessiner = null;

  function lancerMer(s) {
    arreterMer();
    const mer = racine.querySelector(".s-mer");
    const fond = racine.querySelector(".s-mer-fond");
    const ecume = racine.querySelector(".s-ecume");
    const groupeVents = racine.querySelector(".s-vents");

    const amplitude = (s.taille * metre) / 2;
    const longueur = 90 + s.periode * 24;
    const frequence = 1 / (s.periode * 0.35);
    const pointe = 1 + s.periode / 6;
    const clapot = s.type === "terre" ? 0.6 : (s.vent / 40) * (s.type === "mer" ? 8 : 5);
    const moutons = s.type !== "terre" && s.vent >= 18;

    // Le vent de terre souffle vers le large (vers la gauche de la scène)
    const sens = s.type === "terre" ? -1 : 1;
    const derive = s.type === "travers" ? 12 : 0;
    const traits = Array.from({ length: Math.min(8, Math.ceil(s.vent / 4)) }, (_, i) => ({
      x: (i * 97) % 640,
      y: 18 + (i * 29) % 78,
      longueur: 16 + s.vent * 0.8,
    }));
    groupeVents.innerHTML = traits.map(() => "<line/>").join("");
    const lignes = [...groupeVents.children];

    function hauteurA(x, t, phaseFond, reduction) {
      const p = x / longueur - t * frequence + phaseFond;
      const onde = Math.pow((Math.sin(2 * Math.PI * p) + 1) / 2, pointe);
      const rivage = Math.min(1, Math.max(0.1, (finMer - x) / 90));
      const A = amplitude * reduction * rivage;
      const petits = clapot * (Math.sin(x * 0.19 + t * 5) + 0.6 * Math.sin(x * 0.37 - t * 7.3) + 0.4 * Math.sin(x * 0.71 + t * 11));
      return { y: ligneMer + A - 2 * A * onde + petits * rivage, onde };
    }

    dessiner = function (ms) {
      const t = ms / 1000;
      let traceFond = "M0,240";
      let traceMer = "M0,240";
      let traceEcume = "";
      for (let x = 0; x <= finMer; x += 5) {
        traceFond += ` L${x},${(hauteurA(x, t, 0.35, 0.55).y - 14).toFixed(1)}`;
        const { y, onde } = hauteurA(x, t, 0, 1);
        traceMer += ` L${x},${y.toFixed(1)}`;
        const crete = onde > 0.86 && amplitude > 6;
        const mouton = moutons && Math.sin(x * 0.11 + t * 2.4) > 0.72;
        if ((crete || mouton) && x < finMer - 25) traceEcume += ` M${x},${y.toFixed(1)} l6,0`;
      }
      fond.setAttribute("d", traceFond + ` L${finMer},240 Z`);
      mer.setAttribute("d", traceMer + ` L${finMer},240 Z`);
      ecume.setAttribute("d", traceEcume);

      traits.forEach((trait, i) => {
        const x = ((trait.x + sens * s.vent * t * 7) % 700 + 700) % 700 - 40;
        const y = trait.y + Math.sin(t + i) * derive;
        lignes[i].setAttribute("x1", x);
        lignes[i].setAttribute("x2", x + trait.longueur);
        lignes[i].setAttribute("y1", y);
        lignes[i].setAttribute("y2", y);
      });
    };

    dessiner(reduit ? 1400 : performance.now());
    if (!reduit) boucle();
  }

  function boucle() {
    if (!visible || !dessiner) {
      idAnimation = null;
      return;
    }
    dessiner(performance.now());
    idAnimation = requestAnimationFrame(boucle);
  }

  function arreterMer() {
    if (idAnimation) cancelAnimationFrame(idAnimation);
    idAnimation = null;
    dessiner = null;
  }

  // L'animation s'arrête quand le jeu n'est pas à l'écran
  new IntersectionObserver(([entree]) => {
    visible = entree.isIntersecting;
    if (visible && !idAnimation && dessiner && !reduit) boucle();
  }).observe(racine);

  afficherManche();
})();
