/* ==========================================================================
   Swellcome — règles du verdict, partagées par les fiches spots et le jeu
   Critères de départ de docs/contexte.md, à valider avec des surfeurs et des moniteurs.
   Chaque critère vaut 2 (bon), 1 (limite) ou 0 (mauvais) ; le verdict vaut le plus faible.
   La hauteur jugée n'est pas celle du large, mais la taille estimée au bord (tailleAuBord).
   ========================================================================== */

window.SwellcomeVerdict = (function () {
  const NIVEAUX = {
    debutant: { nom: "Débutant", min: 0.5, max: 1, periode: null, vent: "faible" },
    intermediaire: { nom: "Intermédiaire", min: 0.8, max: 1.8, periode: 8, vent: "terre-ou-faible" },
    confirme: { nom: "Confirmé", min: 1.2, max: 2.5, periode: 10, vent: "terre-ou-faible" },
    expert: { nom: "Expert", min: 2, max: Infinity, periode: 12, vent: "terre" },
  };

  const VERDICTS = {
    2: { nom: "Top", badge: "good", icone: "i-shaka", couleur: "#2D6A63" },
    1: { nom: "Correct", badge: "warn", icone: "i-pouce-haut", couleur: "#E6B96C" },
    0: { nom: "À oublier", badge: "neutral", icone: "i-pouce-bas", couleur: "#8A979F" },
  };

  const VENT_FAIBLE = 15; // km/h
  const TAILLE_MINI = 0.5; // m au bord : en dessous, il n'y a presque rien à surfer
    const ECART_SATURATION = 0.5; // m : le haut de la zone idéale reste sous la saturation

  // Part de la houle du large qui arrive au bord selon sa période (période en s, coefficient).
  // Une houle courte manque de force : c'est la correction la plus importante du calcul.
  // Repères à caler avec des observations sur place.
  const EFFET_PERIODE = [[4, 0.25], [5, 0.35], [6, 0.45], [7, 0.58], [8, 0.7], [10, 0.9], [12, 1.05], [14, 1.2], [16, 1.3], [18, 1.35]];
  const EFFET_DIRECTION_INCONNUE = 0.6;

  const LIBELLE_VENT = { offshore: "Offshore", "side-offshore": "Side-offshore", "side-onshore": "Side-onshore", onshore: "Onshore" };

  // État de l'eau selon la classe de vent et sa force : < 8, 8-18, 18-30, > 30 km/h. Conventions à recaler sur le terrain.
  const SURFACE = {
    offshore: ["glassy", "lissé, idéal", "soutenu, take-off dur", "tient les vagues debout"],
    "side-offshore": ["propre", "correct", "clapot léger", "désordonné"],
    "side-onshore": ["lisse", "ridé", "désordonné", "machine à laver"],
    onshore: ["mou mais lisse", "ridé et mou", "désordonné", "machine à laver"],
  };
  const NOTES_SURFACE = { offshore: [2, 2, 1, 0], "side-offshore": [2, 1, 1, 0], "side-onshore": [2, 1, 0, 0], onshore: [1, 1, 0, 0] };
  const RAFALES_RATIO = 1.5;
  const RAFALES_MIN = 45; // km/h : les modèles dépassent le ratio 87 % du temps, ce plancher garde les vrais coups de vent
  const CLE_CONFORT = "swellcome-confort-";
  const CONFORT_SANS_LIMITE = 4;   // m : tout en haut du réglage, plus de limite

  // Taille maximale choisie par le surfeur pour un niveau, ou null
  function lireConfort(cle) {
    try {
      const valeur = Number(localStorage.getItem(CLE_CONFORT + cle));
      return valeur > 0 ? valeur : null;
    } catch (erreur) {
      return null;
    }
  }

  function garderConfort(cle, valeur) {
    try {
      localStorage.setItem(CLE_CONFORT + cle, String(valeur));
    } catch (erreur) { /* sans conséquence : le réglage ne sera juste pas mémorisé */ }
  }

  // Le niveau de départ, avec la taille maximale réglée par le surfeur
  function niveauAvecConfort(cle, saturation, valeur = lireConfort(cle)) {
    const niveau = NIVEAUX[cle];
    const max = valeur == null ? niveau.max : valeur >= CONFORT_SANS_LIMITE ? Infinity : valeur;
    return pourSpot({ ...niveau, max }, saturation);
  }

  // Puissance de la houle, en kW par mètre de crête : environ 0,49 x H² x T
  function motPuissance(houle, periode) {
    if (houle == null || periode == null) return null;
    const puissance = 0.49 * houle * houle * periode;
    return puissance < 3 ? "mou" : puissance < 15 ? "ça pousse" : "puissant";
  }

  // Forme de la vague selon l'angle de la houle, la taille, la période, la marée et la saturation.
  // Réglages de départ, à caler avec les retours de session.
  function formeVague({ hauteur, houle, periode, direction, orientation, mareeEtat, saturation }) {
    if (direction == null || orientation == null || hauteur == null) return null;
    if (saturation && Math.max(hauteur, houle || 0) >= saturation - ECART_SATURATION) return "ça ferme";
    const angle = Math.abs(((direction - orientation + 540) % 360) - 180);
    const seuilFace = mareeEtat && mareeEtat !== "mi-marée" ? 25 : 15;
    if (angle < seuilFace && hauteur >= 1.2 && periode >= 10) return "ça ferme";
    return angle < 35 ? "sections" : "ça déroule";
  }

  const bandeVent = (v) => (v < 8 ? 0 : v < 18 ? 1 : v <= 30 ? 2 : 3);
  const surfaceVent = (v, type) => (SURFACE[type] ? SURFACE[type][bandeVent(v)] : null);

  // Orientation : direction vers laquelle la plage regarde. Direction : d'où vient le vent.
  function typeVent(direction, orientation) {
    if (orientation == null || direction == null) return null;
    const delta = Math.abs(((direction - orientation + 540) % 360) - 180);
    if (delta <= 45) return "onshore";
    if (delta <= 90) return "side-onshore";
    return delta <= 135 ? "side-offshore" : "offshore";
  }

  function effetPeriode(periode) {
    const table = EFFET_PERIODE;
    if (periode <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
      const [t0, c0] = table[i - 1];
      const [t1, c1] = table[i];
      if (periode <= t1) return c0 + (c1 - c0) * (periode - t0) / (t1 - t0);
    }
    return table[table.length - 1][1];
  }

  // 1 si la houle arrive de face, 0 si elle longe la plage ou vient de derrière
  function effetDirection(direction, orientation) {
    if (orientation == null) return 1;
    if (direction == null) return EFFET_DIRECTION_INCONNUE;
    const ecart = Math.abs(((direction - orientation + 540) % 360) - 180);
    return ecart >= 90 ? 0 : Math.cos(ecart * Math.PI / 180) ** 2;
  }

  // Taille estimée au bord, à partir de chaque houle : { hauteur, periode, direction }.
  // Les énergies des houles s'additionnent, d'où la racine de la somme des carrés.
  function tailleAuBord(houles, orientation) {
    const parts = houles
      .filter((h) => h.hauteur != null && h.periode != null)
      .map((h) => h.hauteur * effetPeriode(h.periode) * effetDirection(h.direction, orientation));
    if (!parts.length) return null;
    return Math.round(Math.sqrt(parts.reduce((total, x) => total + x * x, 0)) * 10) / 10;
  }

  // Pleines et basses mers, repérées sur la courbe horaire du niveau de la mer.
  // Une parabole passée par trois heures donne un moment plus fin que l'heure ronde,
  // arrondi au quart d'heure : la donnée ne permet pas mieux. Renvoie [{ t, type, niveau }].
  function extremesMaree(temps, niveaux) {
    const extremes = [];
    for (let i = 1; i < temps.length - 1; i++) {
      const [a, b, c] = [niveaux[i - 1], niveaux[i], niveaux[i + 1]];
      if (a == null || b == null || c == null) continue;
      const pleine = b > a && b >= c;
      const basse = b < a && b <= c;
      if (!pleine && !basse) continue;
      const decalage = (a - c) / (2 * (a - 2 * b + c)); // en heures, entre -0,5 et +0,5
      const quartsDHeure = Math.round((Date.parse(temps[i] + ":00Z") + decalage * 3600000) / 900000);
      extremes.push({
        t: new Date(quartsDHeure * 900000).toISOString().slice(0, 16),
        type: pleine ? "pleine" : "basse",
        niveau: b - (a - c) * decalage / 4,
      });
    }
    return extremes;
  }

  // "montante" ou "descendante" à une heure donnée, d'après l'heure suivante (ou la précédente en fin de série)
  function sensMaree(niveaux, i) {
    const avant = niveaux[i + 1] != null ? niveaux[i] : niveaux[i - 1];
    const apres = niveaux[i + 1] != null ? niveaux[i + 1] : niveaux[i];
    if (avant == null || apres == null) return null;
    return apres >= avant ? "montante" : "descendante";
  }

  // « haute », « mi-marée » ou « basse », selon la place du niveau entre la pleine et la basse mer qui l'encadrent
  function etatMaree(t, niveau, extremes) {
    if (niveau == null || extremes.length < 2) return null;
    const suivante = extremes.findIndex((m) => m.t > t);
    const rang = suivante <= 0 ? (suivante === 0 ? 1 : extremes.length - 1) : suivante;
    const [a, b] = [extremes[rang - 1].niveau, extremes[rang].niveau];
    const part = (niveau - Math.min(a, b)) / Math.abs(a - b);
    if (part >= 0.7) return "haute";
    return part <= 0.3 ? "basse" : "mi-marée";
  }

  // Adapte un niveau à un spot qui sature à partir d'une certaine taille de houle
  function pourSpot(niveau, saturation) {
    if (!saturation) return niveau;
    return {
      ...niveau,
      max: Math.min(niveau.max, saturation - ECART_SATURATION),
      limiteHaute: Number.isFinite(niveau.max) ? niveau.max * 1.1 : saturation,
      saturation,
    };
  }

  function noteHauteur(x, niveau, sature) {
    if (sature || x < TAILLE_MINI) return 0;
    if (x >= niveau.min && x <= niveau.max) return 2;
    const basse = Math.round((niveau.min - 0.1) * 10) / 10; // évite les erreurs d'arrondi (0,7000…1)
    if (x >= basse && x <= (niveau.limiteHaute ?? niveau.max * 1.1)) return 1;
    return 0;
  }

  // Porte de la période : < 7 s mer du vent, 7-9 s molle, puis l'exigence propre au niveau
  function notePeriode(x, niveau) {
    if (x == null) return 1;
    const porte = x < 7 ? 0 : x < 9 ? 1 : 2;
    if (niveau.periode == null) return porte;
    return Math.min(porte, x >= niveau.periode ? 2 : x >= niveau.periode - 2 ? 1 : 0);
  }

  // Porte du vent : classe et force, un cran de moins par fortes rafales, puis les limites du niveau
  function noteVent(vitesse, type, niveau, rafales) {
    if (!NOTES_SURFACE[type]) return vitesse < 15 ? 1 : 0;
    let note = NOTES_SURFACE[type][bandeVent(vitesse)];
    if (rafales != null && rafales > RAFALES_RATIO * vitesse && rafales >= RAFALES_MIN) note = Math.max(note - 1, 0);
    if (niveau.vent === "faible") note = Math.min(note, vitesse < 15 ? 2 : vitesse < 20 ? 1 : 0);
    if (niveau.vent === "terre" && !type.endsWith("offshore")) note = Math.min(note, vitesse < 12 ? 1 : 0);
    return note;
  }

  // hauteur : taille estimée au bord. houle : hauteur annoncée au large.
  function evaluer({ hauteur, houle, periode, vent, type, rafales, forme }, niveau) {
    const sature = Boolean(niveau.saturation) && Math.max(hauteur, houle || 0) >= niveau.saturation;
    const notes = {
      hauteur: noteHauteur(hauteur, niveau, sature),
      vent: noteVent(vent, type, niveau, rafales),
      periode: notePeriode(periode, niveau),
    };
    // Une vague qui ferme n'est jamais « Top », quels que soient le vent et la taille
    const noteForme = forme === "ça ferme" ? 1 : 2;
    return { notes, sature, forme, note: Math.min(notes.hauteur, notes.vent, notes.periode, noteForme) };
  }

  const NOMS_JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const cardinal = (deg) => (deg == null ? "–" : POINTS[Math.round(deg / 22.5) % 16]);
  const POINTS_LONGS = [
    "nord", "nord-nord-est", "nord-est", "est-nord-est", "est", "est-sud-est", "sud-est", "sud-sud-est",
    "sud", "sud-sud-ouest", "sud-ouest", "ouest-sud-ouest", "ouest", "ouest-nord-ouest", "nord-ouest", "nord-nord-ouest",
  ];
  // « d'ouest », « de nord-ouest » : la provenance en toutes lettres
  function deDirection(deg) {
    if (deg == null) return "de direction inconnue";
    const nom = POINTS_LONGS[Math.round(deg / 22.5) % 16];
    return /^[eo]/.test(nom) ? `d'${nom}` : `de ${nom}`;
  }
  const nombre = (x, decimales = 1) =>
    x == null ? "–" : x.toLocaleString("fr-FR", { maximumFractionDigits: decimales });
  const libelleVent = (type) => LIBELLE_VENT[type] || "Vent";
  const heureTexte = (n) => `${n} h`;

  // Prépare les prévisions d'un spot et renvoie de quoi juger chaque heure et chaque journée.
  // spot : { orientation, saturation }. prevision : contenu d'un fichier de data/forecast/.
  function creerAnalyse({ spot, prevision }) {
    const niveaux = Object.fromEntries(
      Object.keys(NIVEAUX).map((cle) => [cle, niveauAvecConfort(cle, spot.saturation)])
    );

    const h = prevision.heures;
    const niveauxMer = h.maree || []; // absent des fichiers collectés avant l'ajout de la marée
    const marees = extremesMaree(h.temps, niveauxMer);
    const heures = h.temps.map((t, i) => ({
      t,
      jour: t.slice(0, 10),
      heure: Number(t.slice(11, 13)),
      // La taille estimée au bord remplace la hauteur du large dans tout l'affichage
      hauteur: tailleAuBord([
        { hauteur: h.houle[i], periode: h.periode[i], direction: h.direction[i] },
        { hauteur: h.houle2[i], periode: h.periode2[i], direction: (h.direction2 || [])[i] },
      ], spot.orientation),
      houle: h.houle[i],
      periode: h.periode[i],
      direction: h.direction[i],
      houle2: h.houle2[i],
      periode2: h.periode2[i],
      eau: h.eau[i],
      vent: h.vent[i],
      rafales: h.rafales[i],
      ventDir: h.vent_dir[i],
      maree: niveauxMer[i] ?? null,
      mareeSens: sensMaree(niveauxMer, i),
      mareeEtat: etatMaree(t, niveauxMer[i], marees),
      houleMin: (h.houle_min || [])[i] ?? null,
      houleMax: (h.houle_max || [])[i] ?? null,
      nbModeles: (h.nb_modeles || [])[i] ?? 0,
      periodeMin: (h.periode_min || [])[i] ?? null,
      periodeMax: (h.periode_max || [])[i] ?? null,
      ventMin: (h.vent_min || [])[i] ?? null,
      ventMax: (h.vent_max || [])[i] ?? null,
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

    const typeVentSpot = (direction) => typeVent(direction, spot.orientation);

    // Écart entre modèles par grandeur. Rang de confiance : 0 proche, 1 moyen, 2 large.
    function ecartsModeles(heure) {
      const rang = (ecart, seuils) => (ecart <= seuils[0] ? 0 : ecart <= seuils[1] ? 1 : 2);
      const grandeur = (min, max, seuils) => (min == null || max == null ? null : { min, max, rang: rang(max - min, seuils) });
      return {
        houle: grandeur(heure.houleMin, heure.houleMax, [0.3, 0.6]),
        periode: grandeur(heure.periodeMin, heure.periodeMax, [1.5, 3]),
        vent: grandeur(heure.ventMin, heure.ventMax, [5, 10]),
      };
    }

    function formeDe(heure) {
      return formeVague({
        hauteur: heure.hauteur, houle: heure.houle, periode: heure.periode, direction: heure.direction,
        orientation: spot.orientation, mareeEtat: heure.mareeEtat, saturation: spot.saturation,
      });
    }

    // « Propre, puissant, ça ferme » : le commentaire affirmé sous le verdict
    function commentaire(heure) {
      const surface = surfaceVent(heure.vent, typeVentSpot(heure.ventDir));
      // Sans vagues au bord, parler de puissance ou de forme n'aurait pas de sens
      const mots = (heure.hauteur < TAILLE_MINI ? [surface, "flat"] : [surface, motPuissance(heure.houle, heure.periode), formeDe(heure)]).filter(Boolean);
      const texte = mots.join(", ");
      return texte ? texte[0].toUpperCase() + texte.slice(1) : "";
    }

    function evaluerHeure(heure, niveau) {
      if (heure.hauteur == null || heure.vent == null) return null;
      return evaluer({
        hauteur: heure.hauteur,
        houle: heure.houle,
        periode: heure.periode,
        vent: heure.vent,
        rafales: heure.rafales,
        type: typeVentSpot(heure.ventDir),
        forme: formeDe(heure),
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
        .map((x) => ({ ...x, eval: evaluerHeure(x, niveau) }))
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
      const tailleMax = Math.max(...utiles.map((x) => x.hauteur));

      for (const seuil of [2, 1]) {
        const suite = plusLongueSuite(utiles, seuil);
        if (suite.length >= dureeMin) {
          return { note: seuil, creneau: suite, repere: meilleureHeure(suite), tailleMax };
        }
      }
      const moinsMauvaise = utiles.reduce((a, b) => (somme(b) > somme(a) ? b : a));
      return { note: 0, creneau: [moinsMauvaise], repere: moinsMauvaise, tailleMax };
    }

    // Le mot court qui remplace « À oublier » sur l'accueil : dit pourquoi ça ne marche pas
    function motif(analyse, niveau) {
      if (analyse.note > 0) return null;
      const h = analyse.repere;
      const { notes, sature } = h.eval;
      if (sature) return "Saturé";
      if (analyse.tailleMax < TAILLE_MINI + 0.1) return "Flat";
      const pire = ["hauteur", "vent", "periode"].reduce((a, b) => (notes[b] < notes[a] ? b : a));
      if (pire === "hauteur") return h.hauteur < niveau.min ? "Trop petit" : "Trop gros";
      return pire === "vent" ? "Vent" : "Houle courte";
    }

    function creneauTexte(analyse, jour) {
      const debut = analyse.creneau[0].heure;
      const dernier = analyse.creneau[analyse.creneau.length - 1].heure;
      const coucher = Number(soleil[jour].coucher.slice(11, 13));
      return `${heureTexte(debut)}-${heureTexte(Math.min(dernier + 1, coucher + 1))}`;
    }

    // Le vent en langue de plage : offshore, onshore ou side
    function ventTexte(heure, avecRafales = false) {
      const type = typeVentSpot(heure.ventDir);
      const nom = (LIBELLE_VENT[type] || "vent").toLowerCase();
      const rafales = avecRafales && heure.rafales != null ? `, rafales ${nombre(heure.rafales, 0)}` : "";
      const mot = surfaceVent(heure.vent, type);
      return `${nom} à ${nombre(heure.vent, 0)} km/h${rafales}${mot && !avecRafales ? ` (${mot})` : ""}`;
    }

    const estWeekEnd = (jour) => [0, 6].includes(new Date(jour + "T12:00:00").getDay());

    // Toujours la même phrase pour un même spot, jour et niveau : elle ne change pas à chaque clic
    function choisir(liste, cle) {
      let somme = 0;
      for (const lettre of cle) somme = (somme * 31 + lettre.charCodeAt(0)) >>> 0;
      return liste[somme % liste.length];
    }

    // « demain », « jeudi » : le prochain jour surfable pour ce niveau
    function prochainJour(jour, niveau) {
      const suivant = jours.find((j) => j > jour && analyserJour(j, niveau).note >= 1);
      if (!suivant) return null;
      const lendemain = new Date(new Date(jour + "T12:00:00").getTime() + 86400000).toISOString().slice(0, 10);
      return suivant === lendemain ? "demain" : NOMS_JOURS[new Date(suivant + "T12:00:00").getDay()];
    }

    // La vanne de fin de phrase, jamais sur la sécurité ni sur un niveau dépassé (voir le Tone of Voice)
    function chute(analyse, jour, niveau, categorie) {
      const weekEnd = estWeekEnd(jour);
      const matin = analyse.creneau[0].heure < 11;
      const lendemain = new Date(new Date(aujourdhui + "T12:00:00").getTime() + 86400000).toISOString().slice(0, 10);
      const listes = {
        top: weekEnd ? ["Pas de boulot, pas d'excuse."] : [
          "Ton boss comprendra. Ou pas, mais tu seras à l'eau.",
          "Le point d'équipe se fera sans toi.",
          "Bloque ton agenda : « rendez-vous extérieur ».",
          "Les mails attendront, la marée non.",
          "Le moment de tester le télétravail depuis le parking.",
          ...(matin ? ["Pose ta matinée."] : []),
          ...(matin && jour === lendemain ? ["Ta grand-mère risque de tomber malade demain matin."] : []),
        ],
        correct: [
          "Parfait pour se dérouiller.",
          ...(weekEnd ? [] : [
            "Pas de quoi poser un RTT, mais de quoi sauver ta pause déj.",
            "Ni bon ni mauvais, comme un lundi.",
            "Le genre de session que tu racontes quand même à la machine à café.",
            ...(matin ? ["Session avant le boulot, douche au bureau."] : []),
          ]),
        ],
        plat: [
          "Bonne nouvelle : ta combi va enfin sécher.",
          ...(weekEnd ? ["Le marché, c'est bien aussi."] : [
            "Excellente journée pour rattraper tes mails.",
            "L'océan a posé un RTT, toi tu bosses.",
            "Range la planche, sors le tableur.",
          ]),
        ],
        onshore: [
          "Garde ta combi au sec.",
          ...(weekEnd ? [] : [
            "Reste au bureau, au moins la clim est stable.",
            "Même ton boss ne te souhaite pas ça.",
          ]),
        ],
        vent: ["Garde ta combi au sec."],
      };
      return choisir(listes[categorie], `${spot.nom || ""}|${jour}|${niveau.nom}|${categorie}`);
    }

    function phrase(analyse, jour, niveau) {
      const r = analyse.repere;
      const taille = `${nombre(r.hauteur)} m au bord`;
      if (analyse.note === 2) {
        // « propre » seulement si le vent ne hache pas les vagues
        const debut = r.eval.notes.vent === 2 ? "Ça rentre propre" : "Ça rentre";
        return `${debut} : ${taille} à ${nombre(r.periode, 0)} s, ${ventTexte(r)}, ${creneauTexte(analyse, jour)}. ${chute(analyse, jour, niveau, "top")}`;
      }
      if (analyse.note === 1) {
        return `Surfable, sans plus : ${taille} à ${nombre(r.periode, 0)} s, ${ventTexte(r)}, ${creneauTexte(analyse, jour)}. ${chute(analyse, jour, niveau, "correct")}`;
      }

      const raison = motif(analyse, niveau);
      const prochain = prochainJour(jour, niveau);
      const fenetre = prochain ? ` Prochaine fenêtre ${prochain}.` : "";
      const retour = prochain ? ` Reviens ${prochain}, ça remonte.` : "";

      // Ton neutre dès que la mer dépasse le niveau : pas de vanne ici
      if (raison === "Saturé") return `Mer trop grosse : les bancs saturent, houle de ${nombre(r.houle)} m au large.${fenetre}`;
      if (raison === "Trop gros") return `${taille} : au-dessus de ta zone aujourd'hui.${fenetre}`;

      if (raison === "Flat") return `Flat comme une crêpe : ${taille}.${retour} ${chute(analyse, jour, niveau, "plat")}`;
      if (raison === "Trop petit") return `Un peu juste pour ton niveau : ${taille}.${retour} ${chute(analyse, jour, niveau, "plat")}`;
      if (raison === "Houle courte") return `Houle trop courte : ${nombre(r.periode, 0)} s, ça manque de jus.${retour} ${chute(analyse, jour, niveau, "plat")}`;
      // La porte du vent a fermé : on dit laquelle, avec les chiffres
      const type = typeVentSpot(r.ventDir);
      const mot = surfaceVent(r.vent, type);
      const categorie = (type || "").endsWith("onshore") ? "onshore" : "vent";
      if (mot === "machine à laver") return `Machine à laver : ${taille} mais ${ventTexte(r, true)}.${fenetre} ${chute(analyse, jour, niveau, categorie)}`;
      return `${ventTexte(r, true)} : ${mot || "trop de vent"}.${fenetre} ${chute(analyse, jour, niveau, categorie)}`.replace(/^./, (c) => c.toUpperCase());
    }

    return {
      NIVEAUX: niveaux, heures, marees, soleil, jours, aujourdhui, parisMaintenant,
      typeVent: typeVentSpot, evaluer: evaluerHeure, estDeJour, analyserJour, phrase, surfaceVent, commentaire, formeDe, motif, creneauTexte, ecartsModeles,
    };
  }

  return {
    NIVEAUX, VERDICTS, LIBELLE_VENT, TAILLE_MINI,
    typeVent, tailleAuBord, pourSpot, evaluer, creerAnalyse,
    nombre, cardinal, deDirection, libelleVent, heureTexte,
    motPuissance, niveauAvecConfort, lireConfort, garderConfort, CONFORT_SANS_LIMITE,
  };
})();
