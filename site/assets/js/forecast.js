/* ==========================================================================
   Swellcome — prévisions d'une fiche spot
   Les données sont écrites dans la page par build.py (balise #donnees-prevision).
   1. Réglages : critères par niveau
   2. Préparation des données
   3. Verdict d'une heure, puis d'une journée
   4. Affichage (niveau, jours, verdict, chiffres, tableau)
   5. Graphique
   ========================================================================== */

(function () {
  const racine = document.getElementById("prevision");
  const source = document.getElementById("donnees-prevision");
  if (!racine || !source) return;

  const { spot, prevision } = JSON.parse(source.textContent);


  /* 1. Réglages : les critères par niveau sont dans verdict.js */

  const V = window.SwellcomeVerdict;
  const { NIVEAUX, VERDICTS } = V;

  const CLE_NIVEAU = "swellcome-niveau";
  const HEURE_DEBUT = 6;             // bornes du graphique
  const HEURE_FIN = 22;
  const DONNEES_ANCIENNES_H = 14;    // au-delà, on prévient que les données datent


  /* 2. Préparation des données */

  const h = prevision.heures;
  const heures = h.temps.map((t, i) => ({
    t,
    jour: t.slice(0, 10),
    heure: Number(t.slice(11, 13)),
    hauteur: h.hauteur[i],
    houle: h.houle[i],
    periode: h.periode[i],
    direction: h.direction[i],
    houle2: h.houle2[i],
    periode2: h.periode2[i],
    eau: h.eau[i],
    vent: h.vent[i],
    rafales: h.rafales[i],
    ventDir: h.vent_dir[i],
  }));

  // Les prévisions sont à l'heure de Paris, quel que soit le fuseau du visiteur
  const parisMaintenant = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short",
  }).format(new Date()).replace(" ", "T");
  const aujourdhui = parisMaintenant.slice(0, 10);
  const heureEnCours = parisMaintenant.slice(0, 13) + ":00";

  const soleil = {};
  prevision.soleil.jours.forEach((jour, i) => {
    soleil[jour] = { lever: prevision.soleil.lever[i], coucher: prevision.soleil.coucher[i] };
  });
  const jours = prevision.soleil.jours.filter((jour) => jour >= aujourdhui);

  const nombre = (x, decimales = 1) =>
    x == null ? "–" : x.toLocaleString("fr-FR", { maximumFractionDigits: decimales });

  const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const cardinal = (deg) => (deg == null ? "–" : POINTS[Math.round(deg / 22.5) % 16]);

  const typeVent = (direction) => V.typeVent(direction, spot.orientation);
  const libelleVent = (type) => V.LIBELLE_VENT[type] || "Vent";


  /* 3. Verdict d'une heure, puis d'une journée */

  function evaluer(heure, niveau) {
    if (heure.hauteur == null || heure.vent == null) return null;
    return V.evaluer({
      hauteur: heure.hauteur,
      periode: heure.periode,
      vent: heure.vent,
      type: typeVent(heure.ventDir),
    }, niveau);
  }

  function estDeJour(heure) {
    const s = soleil[heure.jour];
    return s && heure.t >= s.lever.slice(0, 14) + "00" && heure.t <= s.coucher;
  }

  // Heures encore utiles d'une journée : de jour, et pas déjà passées
  function heuresUtiles(jour, niveau) {
    return heures
      .filter((x) => x.jour === jour && estDeJour(x) && x.t >= heureEnCours)
      .map((x) => ({ ...x, eval: evaluer(x, niveau) }))
      .filter((x) => x.eval);
  }

  function plusLongueSuite(liste, seuil) {
    let meilleure = [];
    let courante = [];
    liste.forEach((x) => {
      courante = x.eval.note >= seuil ? [...courante, x] : [];
      if (courante.length > meilleure.length) meilleure = courante;
    });
    return meilleure;
  }

  const somme = (x) => x.eval.notes.hauteur + x.eval.notes.vent + x.eval.notes.periode;

  // L'heure la mieux notée du créneau ; à égalité, la plus proche du milieu
  function meilleureHeure(suite) {
    const milieu = (suite.length - 1) / 2;
    return suite
      .map((x, i) => ({ x, distance: Math.abs(i - milieu) }))
      .sort((a, b) => somme(b.x) - somme(a.x) || a.distance - b.distance)[0].x;
  }

  // Une journée vaut son meilleur créneau d'au moins 2 heures
  function analyserJour(jour, niveau) {
    const utiles = heuresUtiles(jour, niveau);
    if (!utiles.length) return null;
    const dureeMin = Math.min(2, utiles.length);

    for (const seuil of [2, 1]) {
      const suite = plusLongueSuite(utiles, seuil);
      if (suite.length >= dureeMin) {
        return { note: seuil, creneau: suite, repere: meilleureHeure(suite) };
      }
    }
    const moinsMauvaise = utiles.reduce((a, b) => (somme(b) > somme(a) ? b : a));
    return { note: 0, creneau: [moinsMauvaise], repere: moinsMauvaise };
  }

  function raison(heure, niveau) {
    const { notes } = heure.eval;
    const pire = ["hauteur", "vent", "periode"].reduce((a, b) => (notes[b] < notes[a] ? b : a));
    const limite = notes[pire] === 1;

    if (pire === "hauteur") {
      const sens = heure.hauteur < niveau.min ? "petites" : "grosses";
      return `vagues ${limite ? "un peu" : "trop"} ${sens} (${nombre(heure.hauteur)} m)`;
    }
    if (pire === "vent") {
      return `${libelleVent(typeVent(heure.ventDir)).toLowerCase()} ${limite ? "à surveiller" : "défavorable"} (${nombre(heure.vent, 0)} km/h)`;
    }
    return limite
      ? `houle un peu courte (${nombre(heure.periode, 0)} s)`
      : `houle trop courte (${nombre(heure.periode, 0)} s), vagues molles`;
  }

  const heureTexte = (n) => `${n} h`;

  function creneauTexte(analyse, jour) {
    const debut = analyse.creneau[0].heure;
    const dernier = analyse.creneau[analyse.creneau.length - 1].heure;
    const coucher = Number(soleil[jour].coucher.slice(11, 13));
    return `de ${heureTexte(debut)} à ${heureTexte(Math.min(dernier + 1, coucher + 1))}`;
  }

  function phrase(analyse, jour, niveau) {
    const nom = niveau.nom.toLowerCase();
    const r = analyse.repere;
    if (analyse.note === 2) {
      return `Les conditions collent à un niveau ${nom} ${creneauTexte(analyse, jour)}. ` +
        `Vagues d'environ ${nombre(r.hauteur)} m, ${libelleVent(typeVent(r.ventDir)).toLowerCase()} à ${nombre(r.vent, 0)} km/h.`;
    }
    if (analyse.note === 1) {
      return `Surfable pour un niveau ${nom} ${creneauTexte(analyse, jour)}, sans être idéal : ${raison(analyse.creneau.find((x) => x.eval.note === 1) || r, niveau)}.`;
    }
    return `Pas de créneau adapté à un niveau ${nom}. Le moins mauvais moment, vers ${heureTexte(r.heure)} : ${raison(r, niveau)}.`;
  }


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
  let jourChoisi = jours.find((j) => analyserJour(j, NIVEAUX[niveauChoisi])) || jours[0];

  if (!jours.length) {
    return; // données trop anciennes : le résumé écrit par build.py reste affiché
  }

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

  racine.innerHTML = `
    <fieldset class="fc-niveaux">
      <legend>Votre niveau</legend>
      <div class="fc-pilules">
        ${Object.entries(NIVEAUX).map(([cle, n]) => `
          <label class="fc-pilule">
            <input type="radio" name="niveau" value="${cle}" ${cle === niveauChoisi ? "checked" : ""}>
            <span>${n.nom}</span>
          </label>`).join("")}
      </div>
    </fieldset>
    <div class="fc-jours" role="group" aria-label="Choisir un jour"></div>
    <div class="fc-verdict" aria-live="polite"></div>
    <div class="fc-chiffres"></div>
    <div class="fc-carte">
      <h3 class="fc-titre-graph"></h3>
      <div class="fc-graph"></div>
      <div class="fc-legende">
        ${[2, 1, 0].map((n) => `<span><i style="background:${VERDICTS[n].couleur}"></i>${VERDICTS[n].nom}</span>`).join("")}
        <span><i class="fc-nuit"></i>Nuit</span>
      </div>
      <p class="fc-note">Les flèches montrent où va le vent, nord en haut. Survolez ou touchez le graphique pour lire chaque heure.</p>
    </div>
    <details class="fc-detail">
      <summary>Voir le détail heure par heure</summary>
      <div class="table-wrap fc-tableau"></div>
    </details>
    <div class="fc-infos"></div>`;

  const zoneJours = racine.querySelector(".fc-jours");
  const zoneVerdict = racine.querySelector(".fc-verdict");
  const zoneChiffres = racine.querySelector(".fc-chiffres");
  const zoneGraph = racine.querySelector(".fc-graph");
  const titreGraph = racine.querySelector(".fc-titre-graph");
  const zoneTableau = racine.querySelector(".fc-tableau");
  const zoneInfos = racine.querySelector(".fc-infos");

  const hauteurMaxSemaine = Math.max(...heures.map((x) => x.hauteur || 0));

  function miniCourbe(jour) {
    const points = heures.filter((x) => x.jour === jour && x.heure >= HEURE_DEBUT && x.heure <= HEURE_FIN && x.hauteur != null);
    const haut = Math.max(hauteurMaxSemaine, 0.5);
    const trace = points.map((x, i) =>
      `${(i / (points.length - 1 || 1) * 100).toFixed(1)},${(26 - x.hauteur / haut * 22).toFixed(1)}`).join(" ");
    return `<svg class="fc-mini" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${trace}"/></svg>`;
  }

  function afficherJours() {
    const niveau = NIVEAUX[niveauChoisi];
    zoneJours.innerHTML = jours.map((jour) => {
      const analyse = analyserJour(jour, niveau);
      const duJour = heures.filter((x) => x.jour === jour && estDeJour(x) && x.hauteur != null).map((x) => x.hauteur);
      const plage = duJour.length ? `${nombre(Math.min(...duJour))} à ${nombre(Math.max(...duJour))} m` : "–";
      return `
        <button type="button" class="fc-jour" data-jour="${jour}" aria-pressed="${jour === jourChoisi}">
          <span class="fc-jour-nom">${jourCourt(jour)} <small>${dateDe(jour).getDate()}</small></span>
          ${analyse ? badge(analyse.note) : '<span class="badge badge--neutral">Terminé</span>'}
          ${miniCourbe(jour)}
          <span class="fc-jour-plage">${plage}</span>
        </button>`;
    }).join("");
  }

  function afficherVerdict() {
    const niveau = NIVEAUX[niveauChoisi];
    const analyse = analyserJour(jourChoisi, niveau);

    if (!analyse) {
      zoneVerdict.className = "fc-verdict fc-verdict--neutral";
      zoneVerdict.innerHTML = `<p class="fc-phrase">Il ne reste plus d'heure de jour aujourd'hui. Choisissez un autre jour.</p>`;
      zoneChiffres.innerHTML = "";
      return;
    }

    const v = VERDICTS[analyse.note];
    const conseil = niveauChoisi === "debutant"
      ? `<p class="fc-conseil">Débutant : choisissez une zone surveillée ou un cours encadré.</p>` : "";
    zoneVerdict.className = `fc-verdict fc-verdict--${v.badge}`;
    zoneVerdict.innerHTML = `
      <div class="fc-verdict-haut">
        <span class="fc-verdict-jour">${jourLong(jourChoisi)} · ${niveau.nom}</span>
        <strong class="fc-verdict-mot">${icone(v.icone)}${v.nom}</strong>
      </div>
      <p class="fc-phrase">${phrase(analyse, jourChoisi, niveau)}</p>
      ${conseil}`;

    const r = analyse.repere;
    const type = typeVent(r.ventDir);
    const tuile = (valeur, unite, libelle) => `
      <div class="stat">
        <div class="stat-value">${valeur}${unite ? ` <small>${unite}</small>` : ""}</div>
        <div class="stat-label">${libelle}</div>
      </div>`;
    const s = soleil[jourChoisi];
    zoneChiffres.innerHTML = `
      <p class="fc-chiffres-titre">À ${heureTexte(r.heure)}, ${analyse.note === 0 ? "le moins mauvais moment" : "le meilleur moment"} de la journée</p>
      <div class="stats fc-stats">
        ${tuile(nombre(r.hauteur), "m", "Hauteur estimée au large")}
        ${tuile(nombre(r.periode, 0), "s", `Période, houle de ${cardinal(r.direction)}`)}
        ${tuile(nombre(r.vent, 0), "km/h", `${libelleVent(type)}, rafales ${nombre(r.rafales, 0)}`)}
        ${tuile(nombre(r.eau, 0), "°C", "Température de l'eau")}
        ${tuile(s.lever.slice(11).replace(":", " h "), "", "Lever du soleil")}
        ${tuile(s.coucher.slice(11).replace(":", " h "), "", "Coucher du soleil")}
      </div>`;
  }

  function afficherTableau() {
    const niveau = NIVEAUX[niveauChoisi];
    const lignes = heures
      .filter((x) => x.jour === jourChoisi && estDeJour(x))
      .map((x) => {
        const ev = evaluer(x, niveau);
        const type = typeVent(x.ventDir);
        const seconde = x.houle2 != null && x.houle2 >= 0.2
          ? `<br><small class="muted">2e houle ${nombre(x.houle2)} m, ${nombre(x.periode2, 0)} s</small>` : "";
        return `<tr>
          <td>${heureTexte(x.heure)}</td>
          <td>${ev ? badge(ev.note) : "–"}</td>
          <td>${nombre(x.hauteur)} m</td>
          <td>${nombre(x.houle)} m, ${nombre(x.periode, 0)} s, ${cardinal(x.direction)}${seconde}</td>
          <td>${nombre(x.vent, 0)} km/h, ${cardinal(x.ventDir)}<br><small class="muted">${libelleVent(type)}, rafales ${nombre(x.rafales, 0)}</small></td>
        </tr>`;
      }).join("");
    zoneTableau.innerHTML = `
      <table class="data-table">
        <thead><tr><th scope="col">Heure</th><th scope="col">Verdict</th><th scope="col">Hauteur</th><th scope="col">Houle</th><th scope="col">Vent</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>`;
  }

  function afficherInfos() {
    const maj = new Date(prevision.mis_a_jour.replace("Z", ":00Z"));
    const ancien = (Date.now() - maj.getTime()) / 3600000 > DONNEES_ANCIENNES_H;
    const texteMaj = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    }).format(maj);
    const alerte = ancien ? `
      <div class="notice" style="margin-bottom:14px">
        ${icone("i-alert")}
        <div><p><strong>Ces prévisions datent du ${texteMaj}.</strong> La mise à jour automatique a pris du retard : elles peuvent ne plus être fiables.</p></div>
      </div>` : "";
    zoneInfos.innerHTML = `${alerte}
      <p class="fc-note">Mis à jour le ${texteMaj}, heure de Paris. Hauteurs estimées par modèle au large (point ${nombre(prevision.point_modele.lat, 2)}° N, ${nombre(Math.abs(prevision.point_modele.lon), 2)}° O), elles peuvent différer de ce que vous verrez au bord. La marée sera ajoutée bientôt : le verdict n'en tient pas encore compte. Critères de départ, en cours de validation avec des surfeurs. <a href="${racine.dataset.guide}">Apprendre à lire un forecast</a>.</p>`;
  }


  /* 5. Graphique : hauteur des vagues heure par heure, avec la zone idéale du niveau */

  let dernierCalcul = null;

  function dessinerGraphique() {
    const largeur = zoneGraph.clientWidth;
    if (largeur < 160) return; // zone repliée ou en cours de redimensionnement

    const niveau = NIVEAUX[niveauChoisi];
    const etroit = largeur < 480;
    const marges = { gauche: 34, droite: 22, haut: 22 };
    const hauteurTrace = etroit ? 150 : 190;
    const bas = marges.haut + hauteurTrace;
    const totale = bas + 150;

    const donnees = heures
      .filter((x) => x.jour === jourChoisi && x.heure >= HEURE_DEBUT && x.heure <= HEURE_FIN)
      .map((x) => ({ ...x, eval: estDeJour(x) ? evaluer(x, niveau) : null }));
    const points = donnees.filter((x) => x.hauteur != null);

    // L'échelle verticale est la même toute la semaine, pour comparer les jours d'un coup d'œil
    const repereZone = Number.isFinite(niveau.max) ? niveau.max : niveau.min + 1;
    const sommet = Math.ceil(Math.max(hauteurMaxSemaine, repereZone) * 1.15 * 2) / 2;
    const pas = sommet <= 2.5 ? 0.5 : 1;

    const x = (heure) => marges.gauche + (heure - HEURE_DEBUT) / (HEURE_FIN - HEURE_DEBUT) * (largeur - marges.gauche - marges.droite);
    const y = (valeur) => bas - valeur / sommet * hauteurTrace;
    const s = soleil[jourChoisi];
    const enHeures = (t) => Number(t.slice(11, 13)) + Number(t.slice(14, 16)) / 60;

    let svg = "";

    // Nuit
    const finNuit = Math.max(HEURE_DEBUT, enHeures(s.lever));
    const debutNuit = Math.min(HEURE_FIN, enHeures(s.coucher));
    if (finNuit > HEURE_DEBUT) svg += `<rect class="g-nuit" x="${x(HEURE_DEBUT)}" y="${marges.haut}" width="${x(finNuit) - x(HEURE_DEBUT)}" height="${hauteurTrace}"/>`;
    if (debutNuit < HEURE_FIN) svg += `<rect class="g-nuit" x="${x(debutNuit)}" y="${marges.haut}" width="${x(HEURE_FIN) - x(debutNuit)}" height="${hauteurTrace}"/>`;

    // Grille et axe des hauteurs
    for (let v = 0; v <= sommet + 0.001; v += pas) {
      svg += `<line class="g-grille" x1="${marges.gauche}" x2="${largeur - marges.droite}" y1="${y(v)}" y2="${y(v)}"/>`;
      svg += `<text x="${marges.gauche - 6}" y="${y(v) + 4}" text-anchor="end">${v === 0 ? "0" : nombre(v) + " m"}</text>`;
    }

    // Aire et courbe de la hauteur
    if (points.length > 1) {
      const trace = points.map((p) => `${x(p.heure).toFixed(1)},${y(p.hauteur).toFixed(1)}`).join(" L");
      svg += `<path class="g-aire" d="M${x(points[0].heure)},${bas} L${trace} L${x(points[points.length - 1].heure)},${bas} Z"/>`;
    }

    // Zone idéale du niveau choisi
    const hautZone = Math.min(niveau.max, sommet);
    svg += `<rect class="g-zone" x="${marges.gauche}" y="${y(hautZone)}" width="${largeur - marges.gauche - marges.droite}" height="${y(niveau.min) - y(hautZone)}"/>`;
    svg += `<line class="g-zone-bord" x1="${marges.gauche}" x2="${largeur - marges.droite}" y1="${y(niveau.min)}" y2="${y(niveau.min)}"/>`;
    if (Number.isFinite(niveau.max)) svg += `<line class="g-zone-bord" x1="${marges.gauche}" x2="${largeur - marges.droite}" y1="${y(hautZone)}" y2="${y(hautZone)}"/>`;
    const bornes = Number.isFinite(niveau.max) ? `${nombre(niveau.min)} à ${nombre(niveau.max)} m` : `${nombre(niveau.min)} m et plus`;
    svg += `<text class="g-zone-texte" x="${marges.gauche + 8}" y="${Number.isFinite(niveau.max) ? y(hautZone) - 6 : y(hautZone) + 15}">${largeur < 420 ? "Idéal" : `Zone idéale ${niveau.nom.toLowerCase()}`} : ${bornes}</text>`;

    if (points.length > 1) {
      const trace = points.map((p) => `${x(p.heure).toFixed(1)},${y(p.hauteur).toFixed(1)}`).join(" L");
      svg += `<path class="g-ligne" d="M${trace}"/>`;
    }

    // Repère « maintenant »
    if (jourChoisi === aujourdhui) {
      const instant = enHeures(parisMaintenant);
      if (instant >= HEURE_DEBUT && instant <= HEURE_FIN) {
        svg += `<line class="g-maintenant" x1="${x(instant)}" x2="${x(instant)}" y1="${marges.haut}" y2="${bas}"/>`;
      }
    }

    // Heures
    // Une colonne toutes les 2 heures, toutes les 3 heures sur téléphone pour rester lisible
    const ecartColonnes = largeur < 420 ? 3 : 2;
    const colonnes = donnees.filter((p) => (p.heure - HEURE_DEBUT) % ecartColonnes === 0);
    colonnes.forEach((p) => {
      svg += `<text x="${x(p.heure)}" y="${bas + 16}" text-anchor="middle">${p.heure} h</text>`;
    });

    // Ruban de verdict : une case par heure de jour
    const case_ = (x(HEURE_DEBUT + 1) - x(HEURE_DEBUT));
    donnees.forEach((p) => {
      if (!p.eval) return;
      svg += `<rect x="${x(p.heure) - case_ / 2 + 1}" y="${bas + 24}" width="${case_ - 2}" height="8" rx="2" fill="${VERDICTS[p.eval.note].couleur}"/>`;
    });

    // Rangées de chiffres
    svg += `<text class="g-rangee" x="0" y="${bas + 52}">Période (secondes)</text>`;
    colonnes.forEach((p) => {
      svg += `<text class="g-valeur" x="${x(p.heure)}" y="${bas + 69}" text-anchor="middle">${nombre(p.periode, 0)}</text>`;
    });

    svg += `<text class="g-rangee" x="0" y="${bas + 92}">Vent (km/h)</text>`;
    colonnes.forEach((p) => {
      const type = typeVent(p.ventDir);
      const court = { terre: "Terre", mer: "Mer", travers: etroit ? "Trav." : "Travers" }[type] || "";
      if (p.ventDir != null) {
        svg += `<g transform="translate(${x(p.heure)},${bas + 106}) rotate(${(p.ventDir + 180) % 360})"><path class="g-fleche" d="M0,8 L0,-7 M-4,-2.5 L0,-7 L4,-2.5"/></g>`;
      }
      svg += `<text class="g-valeur" x="${x(p.heure)}" y="${bas + 131}" text-anchor="middle">${nombre(p.vent, 0)}</text>`;
      svg += `<text x="${x(p.heure)}" y="${bas + 146}" text-anchor="middle">${court}</text>`;
    });

    zoneGraph.innerHTML = `
      <svg class="fc-svg" width="${largeur}" height="${totale}" viewBox="0 0 ${largeur} ${totale}" role="img"
           aria-label="Hauteur des vagues heure par heure, ${jourLong(jourChoisi)}. Le détail est dans le tableau sous le graphique.">
        ${svg}
        <line class="g-curseur" y1="${marges.haut}" y2="${bas}" visibility="hidden"/>
        <circle class="g-point" r="5" visibility="hidden"/>
        <rect class="g-capteur" x="${marges.gauche}" y="0" width="${largeur - marges.gauche - marges.droite}" height="${bas + 40}"/>
      </svg>
      <div class="fc-bulle" hidden></div>`;

    brancherSurvol(points, x, y, marges, largeur);
    dernierCalcul = largeur;
  }

  // Curseur et bulle d'information
  function brancherSurvol(points, x, y, marges, largeur) {
    const capteur = zoneGraph.querySelector(".g-capteur");
    const curseur = zoneGraph.querySelector(".g-curseur");
    const point = zoneGraph.querySelector(".g-point");
    const bulle = zoneGraph.querySelector(".fc-bulle");
    if (!points.length) return;

    function montrer(evenement) {
      const rect = capteur.getBoundingClientRect();
      const position = evenement.clientX - rect.left + marges.gauche;
      const p = points.reduce((a, b) => (Math.abs(x(b.heure) - position) < Math.abs(x(a.heure) - position) ? b : a));
      const px = x(p.heure);
      const py = y(p.hauteur);

      curseur.setAttribute("x1", px);
      curseur.setAttribute("x2", px);
      curseur.setAttribute("visibility", "visible");
      point.setAttribute("cx", px);
      point.setAttribute("cy", py);
      point.setAttribute("visibility", "visible");

      const type = typeVent(p.ventDir);
      bulle.innerHTML = `
        <strong>${heureTexte(p.heure)}${p.eval ? ` · ${VERDICTS[p.eval.note].nom}` : " · Nuit"}</strong><br>
        Vagues ${nombre(p.hauteur)} m, période ${nombre(p.periode, 0)} s<br>
        ${libelleVent(type)} ${nombre(p.vent, 0)} km/h, rafales ${nombre(p.rafales, 0)}`;
      bulle.hidden = false;
      const largeurBulle = bulle.offsetWidth;
      const gauche = px + 14 + largeurBulle > largeur ? px - 14 - largeurBulle : px + 14;
      bulle.style.left = Math.max(0, Math.min(gauche, largeur - largeurBulle)) + "px";
      bulle.style.top = Math.max(0, py - bulle.offsetHeight - 8) + "px";
    }

    function cacher() {
      curseur.setAttribute("visibility", "hidden");
      point.setAttribute("visibility", "hidden");
      bulle.hidden = true;
    }

    capteur.addEventListener("pointermove", montrer);
    capteur.addEventListener("pointerdown", montrer);
    capteur.addEventListener("pointerleave", cacher);
  }

  function toutAfficher() {
    afficherJours();
    afficherVerdict();
    afficherTableau();
    titreGraph.textContent = `Vagues et vent · ${jourLong(jourChoisi)}`;
    dessinerGraphique();
  }

  racine.querySelector(".fc-niveaux").addEventListener("change", (evenement) => {
    niveauChoisi = evenement.target.value;
    garderNiveau(niveauChoisi);
    toutAfficher();
  });

  zoneJours.addEventListener("click", (evenement) => {
    const bouton = evenement.target.closest(".fc-jour");
    if (!bouton) return;
    jourChoisi = bouton.dataset.jour;
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
