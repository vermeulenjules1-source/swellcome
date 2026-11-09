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
    2: { nom: "Top", badge: "good", icone: "i-check", couleur: "#2D6A63" },
    1: { nom: "Correct", badge: "warn", icone: "i-minus", couleur: "#E6B96C" },
    0: { nom: "À oublier", badge: "neutral", icone: "i-close", couleur: "#8A979F" },
  };

  const VENT_FAIBLE = 15; // km/h
  const TAILLE_MINI = 0.5; // m au bord : en dessous, il n'y a presque rien à surfer
  const ECART_SATURATION = 0.5; // m : le haut de la zone idéale reste sous la saturation

  // Part de la houle du large qui arrive au bord selon sa période (période en s, coefficient).
  // Une houle courte manque de force : c'est la correction la plus importante du calcul.
  // Repères à caler avec des observations sur place.
  const EFFET_PERIODE = [[4, 0.25], [5, 0.35], [6, 0.45], [7, 0.58], [8, 0.7], [10, 0.9], [12, 1.05], [14, 1.2], [16, 1.3], [18, 1.35]];
  const EFFET_DIRECTION_INCONNUE = 0.6;

  const LIBELLE_VENT = { terre: "Vent de terre", mer: "Vent de mer", travers: "Vent de travers" };

  // Orientation : direction vers laquelle la plage regarde. Direction : d'où vient le vent.
  function typeVent(direction, orientation) {
    if (orientation == null || direction == null) return null;
    const venantDeLaTerre = (orientation + 180) % 360;
    const ecart = Math.abs(((direction - venantDeLaTerre + 540) % 360) - 180);
    if (ecart <= 45) return "terre";
    if (ecart >= 135) return "mer";
    return "travers";
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

  function notePeriode(x, niveau) {
    if (niveau.periode == null) return 2;
    if (x == null) return 1;
    if (x >= niveau.periode) return 2;
    return x >= niveau.periode - 2 ? 1 : 0;
  }

  function noteVent(vitesse, type, niveau) {
    if (niveau.vent === "faible") {
      if (vitesse < VENT_FAIBLE) return 2;
      return vitesse < 20 ? 1 : 0;
    }
    if (niveau.vent === "terre") {
      if (type === "terre") return vitesse < 40 ? 2 : 1;
      return vitesse < 12 ? 1 : 0;
    }
    // Vent de terre ou vent faible
    if (vitesse < VENT_FAIBLE) return 2;
    if (type === "terre") return vitesse < 35 ? 2 : 1;
    if (type === "travers") return vitesse < 22 ? 1 : 0;
    return vitesse < 18 ? 1 : 0;
  }

  // hauteur : taille estimée au bord. houle : hauteur annoncée au large.
  function evaluer({ hauteur, houle, periode, vent, type }, niveau) {
    const sature = Boolean(niveau.saturation) && Math.max(hauteur, houle || 0) >= niveau.saturation;
    const notes = {
      hauteur: noteHauteur(hauteur, niveau, sature),
      vent: noteVent(vent, type, niveau),
      periode: notePeriode(periode, niveau),
    };
    return { notes, sature, note: Math.min(notes.hauteur, notes.vent, notes.periode) };
  }

  const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const cardinal = (deg) => (deg == null ? "–" : POINTS[Math.round(deg / 22.5) % 16]);
  const nombre = (x, decimales = 1) =>
    x == null ? "–" : x.toLocaleString("fr-FR", { maximumFractionDigits: decimales });
  const libelleVent = (type) => LIBELLE_VENT[type] || "Vent";
  const heureTexte = (n) => `${n} h`;

  // Prépare les prévisions d'un spot et renvoie de quoi juger chaque heure et chaque journée.
  // spot : { orientation, saturation }. prevision : contenu d'un fichier de data/forecast/.
  function creerAnalyse({ spot, prevision }) {
    const niveaux = Object.fromEntries(
      Object.entries(NIVEAUX).map(([cle, niveau]) => [cle, pourSpot(niveau, spot.saturation)])
    );

    const h = prevision.heures;
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

    function evaluerHeure(heure, niveau) {
      if (heure.hauteur == null || heure.vent == null) return null;
      return evaluer({
        hauteur: heure.hauteur,
        houle: heure.houle,
        periode: heure.periode,
        vent: heure.vent,
        type: typeVentSpot(heure.ventDir),
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
        if (heure.eval.sature) return `mer trop grosse, les bancs saturent (houle de ${nombre(heure.houle)} m)`;
        if (heure.hauteur < TAILLE_MINI) return `presque rien au bord (${nombre(heure.hauteur)} m)`;
        const sens = heure.hauteur < niveau.min ? "petites" : "grosses";
        return `vagues ${limite ? "un peu" : "trop"} ${sens} (${nombre(heure.hauteur)} m)`;
      }
      if (pire === "vent") {
        return `${libelleVent(typeVentSpot(heure.ventDir)).toLowerCase()} ${limite ? "à surveiller" : "défavorable"} (${nombre(heure.vent, 0)} km/h)`;
      }
      return limite
        ? `houle un peu courte (${nombre(heure.periode, 0)} s)`
        : `houle trop courte (${nombre(heure.periode, 0)} s), vagues molles`;
    }

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
          `Vagues d'environ ${nombre(r.hauteur)} m au bord, ${libelleVent(typeVentSpot(r.ventDir)).toLowerCase()} à ${nombre(r.vent, 0)} km/h.`;
      }
      if (analyse.note === 1) {
        return `Surfable pour un niveau ${nom} ${creneauTexte(analyse, jour)}, sans être idéal : ${raison(analyse.creneau.find((x) => x.eval.note === 1) || r, niveau)}.`;
      }
      return `Pas de créneau adapté à un niveau ${nom}. Le moins mauvais moment, vers ${heureTexte(r.heure)} : ${raison(r, niveau)}.`;
    }

    return {
      NIVEAUX: niveaux, heures, soleil, jours, aujourdhui, parisMaintenant,
      typeVent: typeVentSpot, evaluer: evaluerHeure, estDeJour, analyserJour, phrase,
    };
  }

  return {
    NIVEAUX, VERDICTS, LIBELLE_VENT, TAILLE_MINI,
    typeVent, tailleAuBord, pourSpot, evaluer, creerAnalyse,
    nombre, cardinal, libelleVent, heureTexte,
  };
})();
