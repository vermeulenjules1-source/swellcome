/* ==========================================================================
   Swellcome — prévisions d'une fiche spot
   Les données sont écrites dans la page par build.py (balise #donnees-prevision).
   1. Réglages
   2 et 3. Données et verdict (verdict.js)
   4. Affichage (niveau, jours, verdict, chiffres, tableau)
   5. Graphique
   ========================================================================== */

(function () {
  const racine = document.getElementById("prevision");
  const source = document.getElementById("donnees-prevision");
  if (!racine || !source) return;

  const { spot, prevision } = JSON.parse(source.textContent);


  /* 1. Réglages */

  const V = window.SwellcomeVerdict;
  const { VERDICTS, nombre, deDirection, libelleVent, heureTexte } = V;

  const CLE_NIVEAU = "swellcome-niveau";
  const COULEURS_BARRES = { 2: "#77B9B1", 1: "#E6B96C", 0: "#5F7480" }; // Top, Correct, Jour off, sur fond sombre
  const DONNEES_ANCIENNES_H = 14;    // au-delà, on prévient que les données datent


  /* 2 et 3. Données et verdict : le calcul est dans verdict.js, partagé avec la carte de l'accueil */

  const {
    NIVEAUX, heures, marees, soleil, jours, aujourdhui, parisMaintenant,
    typeVent, evaluer, estDeJour, analyserJour, phrase, motif, creneauTexte, accordModeles,
  } = V.creerAnalyse({ spot, prevision });


  /* 4. Affichage */

  function lireNiveau() {
    try {
      const garde = localStorage.getItem(CLE_NIVEAU);
      if (NIVEAUX[garde]) return garde;
    } catch (erreur) { /* stockage indisponible : on garde la valeur par défaut */ }
    return "debutant";
  }

  function garderNiveau(valeur) {
    try {
      localStorage.setItem(CLE_NIVEAU, valeur);
    } catch (erreur) { /* sans conséquence : le niveau ne sera juste pas mémorisé */ }
  }

  let niveauChoisi = lireNiveau();
  let heureChoisie = 12;
  let jourChoisi = jours.find((j) => analyserJour(j, NIVEAUX[niveauChoisi])) || jours[0];

  if (!jours.length) {
    return; // données trop anciennes : le résumé écrit par build.py reste affiché
  }

  const bornesNiveau = (n) =>
    Number.isFinite(n.max) ? `${nombre(n.min)} à ${nombre(n.max)} m` : `${nombre(n.min)} m et plus`;

  const icone = (nom, classe = "icon") =>
    `<svg class="${classe}" aria-hidden="true"><use href="#${nom}"></use></svg>`;

  const badge = (note) => {
    const v = VERDICTS[note];
    return `<span class="badge badge--${v.badge}">${icone(v.icone, "icon fc-icone-badge")}${v.nom}</span>`;
  };

  const NOMS_JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const NOMS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const dateDe = (jour) => new Date(jour + "T12:00:00");
  const jourCourt = (jour) => (jour === aujourdhui ? "Auj." : NOMS_JOURS[dateDe(jour).getDay()]);
  const jourLong = (jour) => {
    const d = dateDe(jour);
    return jour === aujourdhui ? "Aujourd'hui" : `${NOMS_LONGS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
  };

  // « Mi-marée », « Marée haute », « Marée basse »
  const libelleMaree = (etat) => (etat === "mi-marée" ? "Mi-marée" : `Marée ${etat}`);
  const heureMinute = (t) => {
    const minutes = t.slice(14, 16);
    return `${Number(t.slice(11, 13))} h${minutes === "00" ? "" : ` ${minutes}`}`;
  };

  racine.innerHTML = `
    <fieldset class="fc-niveaux">
      <legend>Votre niveau</legend>
      <div class="fc-pilules">
        ${Object.entries(NIVEAUX).map(([cle, n]) => `
          <label class="fc-pilule">
            <input type="radio" name="niveau" value="${cle}" ${cle === niveauChoisi ? "checked" : ""}>
            <span><strong>${n.nom}</strong><small>${bornesNiveau(n)} au bord</small></span>
          </label>`).join("")}
      </div>
    </fieldset>
    <div class="fc-jours" role="group" aria-label="Choisir un jour"></div>
    <div class="fc-verdict" aria-live="polite"></div>
    <div class="fc-carte">
      <div class="fc-lecture"></div>
      <div class="fc-graph"></div>
      <input class="fc-curseur" type="range" step="1" aria-label="Choisir une heure">
      <div class="fc-zone-marees"></div>
      <div class="fc-legende">
        ${[2, 1, 0].map((n) => `<span><i style="background:${COULEURS_BARRES[n]}"></i>${VERDICTS[n].nom}</span>`).join("")}
        <span><i class="fc-legende-zone"></i><span class="fc-zone-ideale"></span></span>
        <span>Touchez une barre pour lire l'heure</span>
      </div>
    </div>
    <details class="fc-detail" open>
      <summary>Détail heure par heure</summary>
      <div class="fc-tableau"></div>
    </details>
    <details class="fc-detail">
      <summary>Comment c'est calculé</summary>
      <div class="fc-infos"></div>
    </details>
    <div class="fc-alerte"></div>`;

  const zoneJours = racine.querySelector(".fc-jours");
  const zoneVerdict = racine.querySelector(".fc-verdict");
  const zoneLecture = racine.querySelector(".fc-lecture");
  const curseurHeure = racine.querySelector(".fc-curseur");
  const zoneAlerte = racine.querySelector(".fc-alerte");
  const zoneGraph = racine.querySelector(".fc-graph");
  const zoneTableau = racine.querySelector(".fc-tableau");
  const zoneInfos = racine.querySelector(".fc-infos");
  const zoneMarees = racine.querySelector(".fc-zone-marees");
  const zoneIdeale = racine.querySelector(".fc-zone-ideale");

  const hauteurMaxSemaine = Math.max(...heures.map((x) => x.hauteur || 0));

  function afficherJours() {
    const niveau = NIVEAUX[niveauChoisi];
    zoneJours.innerHTML = jours.map((jour) => {
      const analyse = analyserJour(jour, niveau);
      const duJour = heures.filter((x) => x.jour === jour && estDeJour(x) && x.hauteur != null).map((x) => x.hauteur);
      const [mini, maxi] = duJour.length ? [Math.min(...duJour), Math.max(...duJour)] : [null, null];
      const plage = mini == null ? "–" : mini === maxi ? `${nombre(mini)} m` : `${nombre(mini)} à ${nombre(maxi)} m`;
      return `
        <button type="button" class="fc-jour" data-jour="${jour}" aria-pressed="${jour === jourChoisi}">
          <span class="fc-jour-nom">${jourCourt(jour)} <small>${dateDe(jour).getDate()}</small></span>
          ${analyse ? badge(analyse.note) : '<span class="badge badge--neutral">Terminé</span>'}
          <span class="fc-jour-plage">${plage}</span>
        </button>`;
    }).join("");
  }

  // Le verdict du prochain jour utile, repris tout en haut de la fiche
  function afficherUne() {
    const zone = document.getElementById("verdict-une");
    if (!zone) return;
    const niveau = NIVEAUX[niveauChoisi];
    const jour = jours.find((j) => analyserJour(j, niveau));
    if (!jour) {
      zone.hidden = true;
      return;
    }
    const analyse = analyserJour(jour, niveau);
    const v = VERDICTS[analyse.note];
    const quand = jour === aujourdhui ? "Aujourd'hui" : jour === jours[jours.indexOf(aujourdhui) + 1] ? "Demain" : jourLong(jour);
    const detail = analyse.note > 0
      ? `${creneauTexte(analyse, jour)}, environ ${nombre(analyse.repere.hauteur)} m au bord`
      : `${motif(analyse, niveau)}, ${nombre(analyse.tailleMax)} m au bord au mieux`;
    zone.className = `spot-une-verdict spot-une-verdict--${v.badge}`;
    zone.innerHTML = `
      <strong>${icone(v.icone)}${v.nom}</strong>
      <span>${quand}, niveau ${niveau.nom.toLowerCase()}<br>${detail}</span>`;
    zone.hidden = false;
  }

  function afficherVerdict() {
    const niveau = NIVEAUX[niveauChoisi];
    const analyse = analyserJour(jourChoisi, niveau);

    if (!analyse) {
      zoneVerdict.className = "fc-verdict fc-verdict--neutral";
      zoneVerdict.innerHTML = `<p class="fc-phrase">Il ne reste plus d'heure de jour aujourd'hui. Choisissez un autre jour.</p>`;
      heureChoisie = 12;
      return;
    }

    const v = VERDICTS[analyse.note];
    const conseil = niveauChoisi === "debutant"
      ? `<p class="fc-conseil">Débutant : prenez un cours avec une école de surf, et restez toujours hors de la zone de baignade.</p>` : "";
    const comparaison = accordModeles(analyse.repere);
    const accord = !comparaison ? "" : comparaison.accord
      ? `<p class="fc-accord"><strong>Modèles d'accord</strong> : houle de ${nombre(comparaison.min)} à ${nombre(comparaison.max)} m au large.</p>`
      : `<p class="fc-accord fc-accord--incertain"><strong>Prévision incertaine</strong> : selon les modèles, houle de ${nombre(comparaison.min)} à ${nombre(comparaison.max)} m au large. Revenez avant d'y aller.</p>`;
    zoneVerdict.className = `fc-verdict fc-verdict--${v.badge}`;
    zoneVerdict.innerHTML = `
      <div class="fc-verdict-haut">
        <span class="fc-verdict-jour">${jourLong(jourChoisi)} · ${niveau.nom}</span>
        <strong class="fc-verdict-mot">${icone(v.icone)}${v.nom}</strong>
      </div>
      <p class="fc-phrase">${phrase(analyse, jourChoisi, niveau)}</p>
      ${accord}
      ${conseil}`;

    heureChoisie = analyse.repere.heure;
  }

  // Les chiffres de l'heure choisie sur le graphique ou le curseur
  function afficherLecture() {
    const p = heures.find((x) => x.jour === jourChoisi && x.heure === heureChoisie);
    if (!p) return;
    const ev = estDeJour(p) ? evaluer(p, NIVEAUX[niveauChoisi]) : null;
    const s = soleil[jourChoisi];
    const type = typeVent(p.ventDir);
    const valeur = (chiffre, unite, libelle) => `
      <div class="fc-valeur">
        <strong>${chiffre}${unite ? `<small> ${unite}</small>` : ""}</strong>
        <span>${libelle}</span>
      </div>`;
    zoneLecture.innerHTML = `
      <div class="fc-heure">
        <strong>${heureTexte(p.heure)}</strong>
        ${ev ? badge(ev.note) : '<span class="badge badge--neutral">Nuit</span>'}
      </div>
      <div class="fc-valeurs">
        ${valeur(nombre(p.hauteur), "m", "au bord")}
        ${valeur(nombre(p.houle), "m", `houle ${deDirection(p.direction)}, ${nombre(p.periode, 0)} s`)}
        ${valeur(nombre(p.vent, 0), "km/h", `${libelleVent(type).toLowerCase()}, rafales ${nombre(p.rafales, 0)}`)}
        ${valeur(nombre(p.eau, 0), "°C", `eau · soleil ${s.lever.slice(11)}–${s.coucher.slice(11)}`)}
        ${p.mareeEtat ? valeur(libelleMaree(p.mareeEtat), "", p.mareeSens) : ""}
      </div>`;
  }

  // Pleines et basses mers du jour choisi
  function afficherMarees() {
    const duJour = marees.filter((m) => m.t.startsWith(jourChoisi));
    zoneMarees.innerHTML = duJour.length ? `
      <ul class="fc-marees" aria-label="Marées du jour">
        ${duJour.map((m) => `<li><strong>${m.type === "pleine" ? "Pleine mer" : "Basse mer"}</strong> vers ${heureMinute(m.t)}</li>`).join("")}
        <li class="fc-marees-note">Horaires indicatifs</li>
      </ul>` : "";
  }

  function choisirHeure(heure) {
    heureChoisie = heure;
    curseurHeure.value = heure;
    afficherLecture();
    placerCurseur();
  }

  // Le détail d'une journée : une ligne par heure, chaque valeur porte son propre libellé
  function afficherTableau() {
    const niveau = NIVEAUX[niveauChoisi];
    const flecheVent = (direction) => direction == null ? "" :
      `<svg class="fc-fleche" viewBox="-10 -10 20 20" aria-hidden="true" style="transform:rotate(${(direction + 180) % 360}deg)"><path d="M0,8 L0,-7 M-4,-2.5 L0,-7 L4,-2.5"/></svg>`;
    const colonne = (classe, principal, detail) =>
      `<div class="fc-c ${classe}"><strong>${principal}</strong><small>${detail}</small></div>`;

    const lignes = heures
      .filter((x) => x.jour === jourChoisi && estDeJour(x))
      .map((x) => {
        const ev = evaluer(x, niveau);
        const type = typeVent(x.ventDir);
        const seconde = x.houle2 != null && x.houle2 >= 0.2 ? `, 2e houle ${nombre(x.houle2)} m` : "";
        const maree = x.mareeEtat
          ? colonne("fc-c-maree", `${x.mareeSens === "montante" ? "↗" : "↘"} ${libelleMaree(x.mareeEtat)}`, x.mareeSens)
          : colonne("fc-c-maree", "–", "marée");
        return `
          <li class="fc-ligne fc-ligne--${ev ? VERDICTS[ev.note].badge : "neutral"}">
            <strong class="fc-ligne-heure">${heureTexte(x.heure)}</strong>
            <div class="fc-ligne-verdict">${ev ? badge(ev.note) : "–"}</div>
            ${colonne("fc-c-taille", `${nombre(x.hauteur)} m`, "au bord")}
            ${colonne("fc-c-houle", `${nombre(x.houle)} m, ${nombre(x.periode, 0)} s`, `houle ${deDirection(x.direction)}${seconde}`)}
            ${colonne("fc-c-vent", `${flecheVent(x.ventDir)}${nombre(x.vent, 0)} km/h`, `${libelleVent(type)}, rafales ${nombre(x.rafales, 0)}`)}
            ${maree}
          </li>`;
      }).join("");
    zoneTableau.innerHTML = `<ol class="fc-lignes">${lignes}</ol>`;
  }

  function afficherInfos() {
    const maj = new Date(prevision.mis_a_jour.replace("Z", ":00Z"));
    const ancien = (Date.now() - maj.getTime()) / 3600000 > DONNEES_ANCIENNES_H;
    const texteMaj = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    }).format(maj);
    if (ancien) {
      zoneAlerte.innerHTML = `
        <div class="notice">
          ${icone("i-alert")}
          <div><p><strong>Ces prévisions datent du ${texteMaj}.</strong> La mise à jour automatique a pris du retard : elles peuvent ne plus être fiables.</p></div>
        </div>`;
    }
    zoneInfos.innerHTML = `
      <p>Mis à jour le ${texteMaj}, heure de Paris.</p>
      <p>La houle retenue est la médiane de quatre modèles : Météo-France, EWAM et GWAM du service météo allemand, GFS de la NOAA. La taille au bord est estimée par Swellcome à partir de cette houle du large (point ${nombre(prevision.point_modele.lat, 2)}° N, ${nombre(Math.abs(prevision.point_modele.lon), 2)}° O), de sa période de pic et de son orientation par rapport à la plage. Les bancs de sable peuvent changer la donne.</p>
      <p>La marée vient du niveau de la mer prévu par Open-Meteo. Elle est indicative, ne convient pas à la navigation et ne remplace pas l'annuaire officiel du Shom. Le verdict n'en tient pas encore compte : son effet dépend de chaque spot.</p>
      <p>Les critères sont en cours de validation avec des surfeurs. <a href="${racine.dataset.guide}">Apprendre à lire un forecast</a>.</p>`;
  }


  /* 5. Graphique : une barre par heure de jour, et la course du soleil au-dessus */

  const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dernierCalcul = null;
  let echelles = null;
  let soleilPosition = 0;      // 0 au lever, 1 au coucher
  let animationSoleil = null;

  function dessinerGraphique() {
    const largeur = zoneGraph.clientWidth;
    if (largeur < 160) return; // zone repliée ou en cours de redimensionnement

    const niveau = NIVEAUX[niveauChoisi];
    zoneIdeale.textContent = `Zone idéale ${niveau.nom.toLowerCase()} : ${bornesNiveau(niveau)}`;

    const points = heures
      .filter((p) => p.jour === jourChoisi && estDeJour(p) && p.hauteur != null)
      .map((p) => ({ ...p, eval: evaluer(p, niveau) }));
    if (!points.length) {
      zoneGraph.innerHTML = "";
      echelles = null;
      return;
    }

    const etroit = largeur < 480;
    const hauteurCiel = etroit ? 44 : 58;
    const horizon = hauteurCiel + 24;
    const marges = { gauche: 34, droite: 8, haut: horizon + 26 };
    const hauteurTrace = etroit ? 130 : 170;
    const bas = marges.haut + hauteurTrace;
    const totale = bas + 150;

    // L'échelle verticale est la même toute la semaine, pour comparer les jours d'un coup d'œil
    const repereZone = Number.isFinite(niveau.max) ? niveau.max : niveau.min + 1;
    const sommet = Math.ceil(Math.max(hauteurMaxSemaine, repereZone) * 1.15 * 2) / 2;
    const pas = sommet <= 2.5 ? 0.5 : 1;

    const premiere = points[0].heure;
    const colonne = (largeur - marges.gauche - marges.droite) / points.length;
    const xHeure = (t) => marges.gauche + (t - premiere) * colonne;
    const centre = (heure) => xHeure(heure + 0.5);
    const y = (valeur) => bas - valeur / sommet * hauteurTrace;

    // Course du soleil : l'abscisse suit l'heure, la hauteur dessine un arc
    const s = soleil[jourChoisi];
    const enHeures = (t) => Number(t.slice(11, 13)) + Number(t.slice(14, 16)) / 60;
    const lever = enHeures(s.lever);
    const coucher = enHeures(s.coucher);
    const xLever = xHeure(Math.max(lever, premiere));
    const xCoucher = xHeure(Math.min(coucher, premiere + points.length));
    const positionSoleil = (p) => ({
      x: xLever + p * (xCoucher - xLever),
      y: horizon - Math.sin(Math.PI * p) * hauteurCiel,
    });
    const cibleSoleil = (heure) => Math.min(1, Math.max(0, (heure + 0.5 - lever) / (coucher - lever)));

    let svg = "";

    const course = Array.from({ length: 41 }, (_, i) => {
      const point = positionSoleil(i / 40);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }).join(" ");
    svg += `<line class="g-horizon" x1="${marges.gauche}" x2="${largeur - marges.droite}" y1="${horizon}" y2="${horizon}"/>`;
    svg += `<polyline class="g-course" points="${course}"/>`;
    svg += `<text x="${xLever}" y="${horizon + 16}">Lever ${heureMinute(s.lever)}</text>`;
    svg += `<text x="${xCoucher}" y="${horizon + 16}" text-anchor="end">Coucher ${heureMinute(s.coucher)}</text>`;
    svg += `<g class="g-soleil" aria-hidden="true">
      <circle class="g-soleil-halo" r="19"/>
      <g class="g-soleil-rayons">${Array.from({ length: 8 }, (_, i) => `<line y1="-14" y2="-18" transform="rotate(${i * 45})"/>`).join("")}</g>
      <circle class="g-soleil-coeur" r="10"/>
    </g>`;

    // Grille et axe des hauteurs
    for (let v = 0; v <= sommet + 0.001; v += pas) {
      svg += `<line class="g-grille" x1="${marges.gauche}" x2="${largeur - marges.droite}" y1="${y(v)}" y2="${y(v)}"/>`;
      svg += `<text x="${marges.gauche - 6}" y="${y(v) + 4}" text-anchor="end">${v === 0 ? "0" : nombre(v) + " m"}</text>`;
    }

    // Zone idéale du niveau choisi
    const hautZone = Math.min(niveau.max, sommet);
    svg += `<rect class="g-zone" x="${marges.gauche}" y="${y(hautZone)}" width="${largeur - marges.gauche - marges.droite}" height="${y(niveau.min) - y(hautZone)}"/>`;

    // Une colonne sur 2 ou 3 sur téléphone, pour que les chiffres restent lisibles
    const ecart = colonne >= 40 ? 1 : colonne >= 20 ? 2 : 3;
    const lisible = (p) => (p.heure - premiere) % ecart === 0;
    const largeurBarre = Math.min(colonne - 6, 46);

    points.forEach((p) => {
      const gauche = centre(p.heure) - largeurBarre / 2;
      const haut = Math.min(y(p.hauteur), bas - 3);
      const rayon = Math.min(5, largeurBarre / 2, bas - haut);
      const couleur = COULEURS_BARRES[p.eval ? p.eval.note : 0];
      const valeur = colonne >= 24 || lisible(p)
        ? `<text class="g-barre-valeur" x="${centre(p.heure)}" y="${haut - 6}" text-anchor="middle">${nombre(p.hauteur)}</text>` : "";
      svg += `<g class="g-colonne" data-heure="${p.heure}">
        <rect class="g-colonne-fond" x="${xHeure(p.heure) + 1}" y="${marges.haut}" width="${colonne - 2}" height="${hauteurTrace}" rx="6"/>
        <path class="g-barre" fill="${couleur}" d="M${gauche},${bas}V${haut + rayon}Q${gauche},${haut} ${gauche + rayon},${haut}H${gauche + largeurBarre - rayon}Q${gauche + largeurBarre},${haut} ${gauche + largeurBarre},${haut + rayon}V${bas}Z"/>
        ${valeur}
      </g>`;
    });

    // Heures et rangées de chiffres
    const colonnes = points.filter(lisible);
    colonnes.forEach((p) => {
      svg += `<text class="g-heure" x="${centre(p.heure)}" y="${bas + 18}" text-anchor="middle">${p.heure} h</text>`;
    });

    svg += `<text class="g-rangee" x="0" y="${bas + 46}">Période (secondes)</text>`;
    colonnes.forEach((p) => {
      svg += `<text class="g-valeur" x="${centre(p.heure)}" y="${bas + 64}" text-anchor="middle">${nombre(p.periode, 0)}</text>`;
    });

    svg += `<text class="g-rangee" x="0" y="${bas + 88}">Vent (km/h)</text>`;
    colonnes.forEach((p) => {
      const type = typeVent(p.ventDir);
      const court = { terre: "Terre", mer: "Mer", travers: etroit ? "Trav." : "Travers" }[type] || "";
      if (p.ventDir != null) {
        svg += `<g transform="translate(${centre(p.heure)},${bas + 104}) rotate(${(p.ventDir + 180) % 360})"><path class="g-fleche" d="M0,8 L0,-7 M-4,-2.5 L0,-7 L4,-2.5"/></g>`;
      }
      svg += `<text class="g-valeur" x="${centre(p.heure)}" y="${bas + 130}" text-anchor="middle">${nombre(p.vent, 0)}</text>`;
      svg += `<text x="${centre(p.heure)}" y="${bas + 145}" text-anchor="middle">${court}</text>`;
    });

    zoneGraph.innerHTML = `
      <svg class="fc-svg" width="${largeur}" height="${totale}" viewBox="0 0 ${largeur} ${totale}" role="img"
           aria-label="Taille estimée des vagues au bord, heure par heure, ${jourLong(jourChoisi)}. Le détail est dans la liste sous le graphique.">
        ${svg}
        <rect class="g-capteur" x="${marges.gauche}" y="${marges.haut}" width="${largeur - marges.gauche - marges.droite}" height="${hauteurTrace + 26}"/>
      </svg>`;

    // Le curseur s'aligne sur le centre des barres
    const derniere = points[points.length - 1].heure;
    curseurHeure.min = premiere;
    curseurHeure.max = derniere;
    curseurHeure.value = heureChoisie;
    curseurHeure.style.marginLeft = `${centre(premiere) - 10}px`;
    curseurHeure.style.width = `${centre(derniere) - centre(premiere) + 20}px`;

    echelles = { centre, marges, points, positionSoleil, cibleSoleil };
    poserSoleil(soleilPosition);
    brancherGraphique();
    placerCurseur();
    dernierCalcul = largeur;
  }

  function poserSoleil(position) {
    soleilPosition = position;
    const groupe = zoneGraph.querySelector(".g-soleil");
    if (!groupe || !echelles) return;
    const { x, y } = echelles.positionSoleil(position);
    groupe.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)})`);
  }

  // Fait glisser le soleil le long de son arc jusqu'à l'heure lue
  function deplacerSoleil(cible) {
    cancelAnimationFrame(animationSoleil);
    if (mouvementReduit) {
      poserSoleil(cible);
      return;
    }
    const depart = soleilPosition;
    const debut = performance.now();
    const duree = Math.min(900, 250 + Math.abs(cible - depart) * 1400);
    const etape = (instant) => {
      const avancement = Math.min((instant - debut) / duree, 1);
      poserSoleil(depart + (cible - depart) * (1 - (1 - avancement) ** 3));
      if (avancement < 1) animationSoleil = requestAnimationFrame(etape);
    };
    animationSoleil = requestAnimationFrame(etape);
  }

  function placerCurseur() {
    if (!echelles) return;
    zoneGraph.querySelectorAll(".g-colonne").forEach((colonne) => {
      colonne.classList.toggle("g-choisie", Number(colonne.dataset.heure) === heureChoisie);
    });
    deplacerSoleil(echelles.cibleSoleil(heureChoisie));
  }

  // Survoler ou toucher le graphique change l'heure lue
  function brancherGraphique() {
    const capteur = zoneGraph.querySelector(".g-capteur");
    const lire = (evenement) => {
      const position = evenement.clientX - capteur.getBoundingClientRect().left + echelles.marges.gauche;
      const plusProche = echelles.points.reduce((a, b) =>
        (Math.abs(echelles.centre(b.heure) - position) < Math.abs(echelles.centre(a.heure) - position) ? b : a));
      if (plusProche.heure !== heureChoisie) choisirHeure(plusProche.heure);
    };
    capteur.addEventListener("pointermove", lire);
    capteur.addEventListener("pointerdown", lire);
  }

  function toutAfficher() {
    afficherUne();
    afficherJours();
    afficherVerdict();
    afficherTableau();
    dessinerGraphique();
    afficherLecture();
    afficherMarees();
  }

  racine.querySelector(".fc-niveaux").addEventListener("change", (evenement) => {
    niveauChoisi = evenement.target.value;
    garderNiveau(niveauChoisi);
    toutAfficher();
  });

  curseurHeure.addEventListener("input", () => choisirHeure(Number(curseurHeure.value)));

  zoneJours.addEventListener("click", (evenement) => {
    const bouton = evenement.target.closest(".fc-jour");
    if (!bouton) return;
    jourChoisi = bouton.dataset.jour;
    soleilPosition = 0; // le soleil repart du lever à chaque changement de jour
    toutAfficher();
    zoneJours.querySelector(`[data-jour="${jourChoisi}"]`).focus();
  });

  // Le graphique est redessiné si la largeur disponible change (rotation du téléphone, etc.)
  new ResizeObserver(() => {
    if (zoneGraph.clientWidth && zoneGraph.clientWidth !== dernierCalcul) dessinerGraphique();
  }).observe(zoneGraph);

  toutAfficher();
  afficherInfos();
})();
