/* ==========================================================================
   Swellcome — carte interactive de la page d'accueil
   Données : assets/data/apercu.json, généré par build.py.
   Le calcul du verdict est celui des fiches spots (verdict.js).
   Si le fichier ou la carte ne chargent pas, la liste des spots reste affichée.
   1. Réglages
   2. Calculs
   3. Affichage (commandes, carte, détail, liste)
   ========================================================================== */

(function () {
  const racine = document.getElementById("carte-spots");
  if (!racine || !window.SwellcomeVerdict || !window.L) return;

  const V = window.SwellcomeVerdict;
  const { VERDICTS, nombre, libelleVent, heureTexte } = V;


  /* 1. Réglages */

  const CLE_NIVEAU = "swellcome-niveau";
  const JOURS_AFFICHES = 3;
  const DONNEES_ANCIENNES_H = 14;
  const ZOOM_SPOT = 13;

  const FOND_IGN = "https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal" +
    "&TILEMATRIXSET=PM&FORMAT=image/png&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2" +
    "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}";

  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function lireNiveau() {
    const demande = new URLSearchParams(window.location.search).get("niveau");
    if (V.NIVEAUX[demande]) {
      garderNiveau(demande);
      return demande;
    }
    try {
      const garde = localStorage.getItem(CLE_NIVEAU);
      if (V.NIVEAUX[garde]) return garde;
    } catch (erreur) { /* stockage indisponible : valeur par défaut */ }
    return "debutant";
  }

  function garderNiveau(valeur) {
    try {
      localStorage.setItem(CLE_NIVEAU, valeur);
    } catch (erreur) { /* le niveau ne sera juste pas mémorisé */ }
  }


  /* 2. Calculs */

  fetch(racine.dataset.apercu)
    .then((reponse) => {
      if (!reponse.ok) throw new Error("Aperçu indisponible");
      return reponse.json();
    })
    .then(demarrer)
    .catch(() => { /* la liste statique des spots reste en place */ });

  function demarrer(spots) {
    spots.forEach((spot, i) => {
      spot.rang = i + 1;
      spot.analyse = spot.prevision
        ? V.creerAnalyse({ spot: { orientation: spot.orientation, saturation: spot.saturation }, prevision: spot.prevision })
        : null;
    });

    const reference = spots.find((s) => s.analyse);
    if (!reference) return;
    const jours = reference.analyse.jours.slice(0, JOURS_AFFICHES);
    if (!jours.length) return;

    let niveauChoisi = lireNiveau();
    let jourChoisi = jours.find((jour) => spots.some((s) => analyser(s, jour))) || jours[0];
    let spotChoisi = null;   // null : le spot le mieux placé est mis en avant

    function analyser(spot, jour, niveau = niveauChoisi) {
      return spot.analyse ? spot.analyse.analyserJour(jour, spot.analyse.NIVEAUX[niveau]) : null;
    }

    const noteDe = (spot) => {
      const analyse = analyser(spot, jourChoisi);
      return analyse ? analyse.note : -1;
    };

    const tailleDe = (spot) => {
      const analyse = analyser(spot, jourChoisi);
      return analyse ? analyse.repere.hauteur : 0;
    };

    // À note égale, le spot où il y a le plus de vagues ; à taille égale, le plus au nord
    const mieuxPlace = () => spots.reduce((a, b) => {
      if (noteDe(b) !== noteDe(a)) return noteDe(b) > noteDe(a) ? b : a;
      return tailleDe(b) > tailleDe(a) ? b : a;
    });

    const nomJour = (jour) => {
      if (jour === reference.analyse.aujourdhui) return "Aujourd'hui";
      const date = new Date(jour + "T12:00:00");
      const demain = new Date(reference.analyse.aujourdhui + "T12:00:00");
      demain.setDate(demain.getDate() + 1);
      if (date.toDateString() === demain.toDateString()) return "Demain";
      return date.toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
    };

    const texteJour = (jour) => (jour === reference.analyse.aujourdhui ? "aujourd'hui" : nomJour(jour).toLowerCase());


    /* 3. Affichage */

    const icone = (nom, classe = "icon") => `<svg class="${classe}" aria-hidden="true"><use href="#${nom}"></use></svg>`;
    const badge = (note) => {
      if (note < 0) return '<span class="badge badge--neutral">Terminé</span>';
      const v = VERDICTS[note];
      return `<span class="badge badge--${v.badge}">${icone(v.icone, "icon fc-icone-badge")}${v.nom}</span>`;
    };

    racine.innerHTML = `
      <div class="carte-controles">
        <fieldset class="fc-niveaux">
          <legend>Votre niveau</legend>
          <div class="fc-pilules">
            ${Object.entries(V.NIVEAUX).map(([cle, n]) => `
              <label class="fc-pilule">
                <input type="radio" name="carte-niveau" value="${cle}" ${cle === niveauChoisi ? "checked" : ""}>
                <span>${n.nom}</span>
              </label>`).join("")}
          </div>
        </fieldset>
        <fieldset class="fc-niveaux">
          <legend>Votre jour</legend>
          <div class="fc-pilules">
            ${jours.map((jour) => `
              <label class="fc-pilule">
                <input type="radio" name="carte-jour" value="${jour}" ${jour === jourChoisi ? "checked" : ""}>
                <span>${nomJour(jour)}</span>
              </label>`).join("")}
          </div>
        </fieldset>
      </div>

      <div class="carte-grille">
        <div class="carte-map-zone">
          <div class="carte-map" id="carte-leaflet"></div>
          <button type="button" class="carte-reset">Toute la côte</button>
          <div class="carte-legende">
            <span><i style="background:${VERDICTS[2].couleur}"></i>Top</span>
            <span><i style="background:${VERDICTS[1].couleur}"></i>Correct</span>
            <span><i style="background:#DDE3E2;border:1px solid #8A979F"></i>À oublier</span>
            <span>Le numéro renvoie à la liste</span>
          </div>
        </div>

        <div class="carte-panneau">
          <div class="carte-detail" aria-live="polite"></div>
          <ol class="carte-liste"></ol>
        </div>
      </div>
      <p class="carte-note"></p>`;

    const zoneDetail = racine.querySelector(".carte-detail");
    const zoneListe = racine.querySelector(".carte-liste");

    const carte = L.map("carte-leaflet", {
      scrollWheelZoom: false,            // la molette continue de faire défiler la page
      dragging: !L.Browser.mobile,       // sur téléphone : deux doigts pour bouger la carte
      zoomSnap: 0.25,                    // cadre la côte au plus juste
      minZoom: 8,
      maxZoom: 17,
      attributionControl: true,
    });
    carte.attributionControl.setPrefix('<a href="https://leafletjs.com/" rel="noopener">Leaflet</a>');
    L.tileLayer(FOND_IGN, {
      tileSize: 256,
      attribution: 'Fond de carte © <a href="https://www.ign.fr/" rel="noopener">IGN</a>',
    }).addTo(carte);

    const limites = L.latLngBounds(spots.map((s) => [s.lat, s.lon]));
    const voirTout = () => carte.fitBounds(limites, { padding: [22, 22], animate: !reduit });
    voirTout();

    new ResizeObserver(() => carte.invalidateSize()).observe(document.getElementById("carte-leaflet"));

    const CLASSE_NOTE = { 2: "good", 1: "warn", 0: "neutral", "-1": "aucun" };

    function iconeSpot(spot, choisi) {
      return L.divIcon({
        className: "carte-marqueur",
        html: `<span class="carte-point carte-point--${CLASSE_NOTE[noteDe(spot)]}${choisi ? " is-choisi" : ""}">${spot.rang}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
    }

    spots.forEach((spot) => {
      spot.marqueur = L.marker([spot.lat, spot.lon], { icon: iconeSpot(spot, false), keyboard: true }).addTo(carte);
      spot.marqueur.bindTooltip(spot.nom, { direction: "right", offset: [16, 0] });
      spot.marqueur.on("click", () => choisir(spot, false));
    });

    function choisir(spot, deplacer) {
      spotChoisi = spot;
      afficher();
      if (deplacer) {
        const position = [spot.lat, spot.lon];
        const zoom = Math.max(carte.getZoom(), ZOOM_SPOT);
        if (reduit) carte.setView(position, zoom);
        else carte.flyTo(position, zoom, { duration: 0.8 });
      }
    }

    function afficherMarqueurs(actif) {
      spots.forEach((spot) => {
        const choisi = spot === actif;
        spot.marqueur.setIcon(iconeSpot(spot, choisi));
        spot.marqueur.setZIndexOffset(choisi ? 1000 : 0);
        const analyse = analyser(spot, jourChoisi);
        const verdict = analyse ? VERDICTS[analyse.note].nom : "Plus d'heure de jour";
        const element = spot.marqueur.getElement();
        if (element) {
          element.setAttribute("role", "button");
          element.setAttribute("aria-label", `${spot.rang}, ${spot.nom} : ${verdict}`);
        }
      });
    }

    function afficherDetail(spot, automatique) {
      const analyse = analyser(spot, jourChoisi);
      const niveau = spot.analyse ? spot.analyse.NIVEAUX[niveauChoisi] : null;
      const webcam = spot.webcam
        ? `<a class="btn btn--secondary" href="${spot.webcam}" target="_blank" rel="noopener">
             ${icone("i-camera")} Webcam <span class="visually-hidden">(nouvelle fenêtre)</span>
           </a>` : "";
      const vignette = spot.vignette ? `<img src="${spot.vignette}" alt="" width="56" height="56">` : "";

      let corps = `<p class="carte-detail-phrase">Plus d'heure de jour ${texteJour(jourChoisi)}. Choisissez un autre jour.</p>`;
      if (analyse) {
        const r = analyse.repere;
        const type = spot.analyse.typeVent(r.ventDir);
        const moment = analyse.note === 0 ? "Moins mauvais moment" : "Meilleur moment";
        corps = `
          ${badge(analyse.note)}
          <p class="carte-detail-phrase">${spot.analyse.phrase(analyse, jourChoisi, niveau)}</p>
          <div class="stats">
            <div class="stat"><div class="stat-value">${nombre(r.hauteur)} <small>m</small></div><div class="stat-label">Au bord, ${heureTexte(r.heure)}</div></div>
            <div class="stat"><div class="stat-value">${nombre(r.periode, 0)} <small>s</small></div><div class="stat-label">Période</div></div>
            <div class="stat"><div class="stat-value">${nombre(r.vent, 0)} <small>km/h</small></div><div class="stat-label">${libelleVent(type)}</div></div>
          </div>
          <span class="visually-hidden">${moment} : ${heureTexte(r.heure)}.</span>`;
      }

      let repere = "";
      if (automatique && analyse) {
        repere = analyse.note > 0
          ? `<span class="carte-detail-repere">Le mieux placé ${texteJour(jourChoisi)} pour votre niveau</span>`
          : `<span class="carte-detail-repere">Aucun spot adapté à votre niveau ${texteJour(jourChoisi)}. Le moins mauvais :</span>`;
      }

      zoneDetail.innerHTML = `
        ${repere}
        <div class="carte-detail-tete">
          ${vignette}
          <div><h3>${spot.rang}. ${spot.nom}</h3><p>${spot.commune}</p></div>
        </div>
        ${corps}
        <div class="carte-detail-actions">
          <a class="btn" href="${spot.url}">Voir les prévisions ${icone("i-arrow-right", "icon icon--fleche")}</a>
          ${webcam}
        </div>`;
    }

    function afficherListe(actif) {
      zoneListe.innerHTML = spots.map((spot) => `
        <li>
          <button type="button" class="carte-ligne" data-slug="${spot.slug}" aria-pressed="${spot === actif}">
            <span class="carte-ligne-rang">${spot.rang}</span>
            <span class="carte-ligne-nom">${spot.nom}<small>${spot.commune}</small></span>
            ${badge(noteDe(spot))}
          </button>
        </li>`).join("");
    }

    function afficherNote() {
      const maj = new Date(reference.prevision.mis_a_jour.replace("Z", ":00Z"));
      const texte = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
      }).format(maj);
      const ancien = (Date.now() - maj.getTime()) / 3600000 > DONNEES_ANCIENNES_H;
      racine.querySelector(".carte-note").textContent =
        `${ancien ? "Attention, données anciennes : mises" : "Mis"} à jour le ${texte}, heure de Paris. ` +
        "Verdict hors marée, tailles estimées au bord à partir du large. Vérifiez toujours les conditions sur place.";
    }

    function afficher() {
      const actif = spotChoisi || mieuxPlace();
      afficherMarqueurs(actif);
      afficherDetail(actif, !spotChoisi);
      afficherListe(actif);
    }

    racine.querySelector(".carte-controles").addEventListener("change", (evenement) => {
      if (evenement.target.name === "carte-niveau") {
        niveauChoisi = evenement.target.value;
        garderNiveau(niveauChoisi);
      } else if (evenement.target.name === "carte-jour") {
        jourChoisi = evenement.target.value;
      }
      afficher();
    });

    zoneListe.addEventListener("click", (evenement) => {
      const ligne = evenement.target.closest(".carte-ligne");
      if (!ligne) return;
      const spot = spots.find((s) => s.slug === ligne.dataset.slug);
      choisir(spot, true);
      zoneListe.querySelector(`[data-slug="${spot.slug}"]`).focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 900px)").matches) {
        racine.querySelector(".carte-map-zone").scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" });
      }
    });

    racine.querySelector(".carte-reset").addEventListener("click", () => {
      spotChoisi = null;
      voirTout();
      afficher();
    });

    afficher();
    afficherNote();
  }
})();
