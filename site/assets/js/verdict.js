/* ==========================================================================
   Swellcome — règles du verdict, partagées par les fiches spots et le jeu
   Critères de départ de docs/contexte.md, à valider avec des surfeurs et des moniteurs.
   Chaque critère vaut 2 (bon), 1 (limite) ou 0 (mauvais) ; le verdict vaut le plus faible.
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

  function noteHauteur(x, niveau) {
    if (x >= niveau.min && x <= niveau.max) return 2;
    if (x >= niveau.min - 0.2 && x <= niveau.max * 1.1) return 1;
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

  function evaluer({ hauteur, periode, vent, type }, niveau) {
    const notes = {
      hauteur: noteHauteur(hauteur, niveau),
      vent: noteVent(vent, type, niveau),
      periode: notePeriode(periode, niveau),
    };
    return { notes, note: Math.min(notes.hauteur, notes.vent, notes.periode) };
  }

  return { NIVEAUX, VERDICTS, LIBELLE_VENT, typeVent, evaluer };
})();
