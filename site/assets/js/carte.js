/* ==========================================================================
   Swellcome — carte interactive de la page d'accueil
   Données : assets/data/apercu.json, généré par build.py.
   Le calcul du verdict est celui des fiches spots (verdict.js).
   Carte : MapLibre GL, chargée quand le visiteur approche de la section.
   Si la carte ne peut pas s'afficher, le panneau et la liste restent utilisables.
   1. Réglages
   2. Calculs
   3. Panneau (commandes, détail, liste)
   4. Carte (fond, satellite, vol vers un spot)
   5. Étiquettes reliées aux spots
   6. Houle animée
   ========================================================================== */

(function () {
  const racine = document.getElementById("carte-spots");
  if (!racine || !window.SwellcomeVerdict) return;

  const V = window.SwellcomeVerdict;
  const { VERDICTS, nombre, libelleVent, heureTexte, cardinal } = V;


  /* 1. Réglages */

  const CLE_NIVEAU = "swellcome-niveau";
  const JOURS_AFFICHES = 3;
  const DONNEES_ANCIENNES_H = 14;
  const ZOOM_SPOT = 13.4;
  const INCLINAISON_SPOT = 52;
  const FPS_HOULE = 12;
  const COULEUR_MER = "#0C3246";
  const COULEUR_TERRE = "#F4F1E9";

  const SATELLITE_IGN = "https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal" +
    "&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS" +
    "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}";

  const TEXTES_GESTES = {
    "CooperativeGesturesHandler.WindowsHelpText": "Ctrl + molette pour zoomer sur la carte",
    "CooperativeGesturesHandler.MacHelpText": "⌘ + molette pour zoomer sur la carte",
    "CooperativeGesturesHandler.MobileHelpText": "Utilisez deux doigts pour bouger la carte",
  };

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

  const webglDisponible = () => {
    const toile = document.createElement("canvas");
    return Boolean(toile.getContext("webgl2") || toile.getContext("webgl"));
  };


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
      spot.court = spot.nom.replace(" – Plage", "").replace(" – L'", " L'").replace("-Plage", "").replace(" Océan", "");
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


    /* 3. Panneau */

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
          <div class="carte-cadre">
            <div class="carte-map" id="carte-gl"></div>
            <div class="carte-calque">
              <svg class="carte-liaisons" aria-hidden="true"></svg>
              <div class="carte-etiquettes" role="group" aria-label="Spots sur la carte"></div>
            </div>
            <p class="carte-houle" hidden></p>
            <div class="carte-boutons">
              <div class="carte-fonds" role="group" aria-label="Fond de carte">
                <button type="button" data-fond="plan" aria-pressed="true">Plan</button>
                <button type="button" data-fond="satellite" aria-pressed="false">Satellite</button>
              </div>
              <button type="button" class="carte-reset">Toute la côte</button>
            </div>
          </div>
          <div class="carte-legende">
            <span><i style="background:${VERDICTS[2].couleur}"></i>Top</span>
            <span><i style="background:${VERDICTS[1].couleur}"></i>Correct</span>
            <span><i style="background:#fff;border:1px solid #8A979F"></i>À oublier</span>
            <span>Touchez une étiquette pour voler vers le spot</span>
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
    const zoneEtiquettes = racine.querySelector(".carte-etiquettes");
    const zoneLiaisons = racine.querySelector(".carte-liaisons");
    const zoneHoule = racine.querySelector(".carte-houle");
    const zoneCarte = racine.querySelector(".carte-map-zone");

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
      afficherDetail(actif, !spotChoisi);
      afficherListe(actif);
      afficherEtiquettes(actif);
      afficherHoule();
    }

    function choisir(spot, voler) {
      spotChoisi = spot;
      afficher();
      if (voler) volerVers(spot);
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
      if (carte && window.matchMedia("(max-width: 900px)").matches) {
        zoneCarte.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" });
      }
    });

    racine.querySelector(".carte-reset").addEventListener("click", () => {
      spotChoisi = null;
      voirTout();
      afficher();
    });


    /* 4. Carte */

    let carte = null;
    let houle = null;

    const limites = spots.reduce(
      (b, s) => [[Math.min(b[0][0], s.lon), Math.min(b[0][1], s.lat)], [Math.max(b[1][0], s.lon), Math.max(b[1][1], s.lat)]],
      [[180, 90], [-180, -90]]
    );

    function largeurEtiquettes() {
      return zoneCarte.clientWidth < 480 ? 130 : 190;
    }

    function voirTout() {
      if (!carte) return;
      carte.fitBounds(limites, {
        padding: { top: zoneCarte.clientWidth < 480 ? 104 : 56, bottom: 34, left: largeurEtiquettes() + 44, right: 40 },
        pitch: 0,
        bearing: 0,
        duration: reduit ? 0 : 1200,
      });
    }

    function volerVers(spot) {
      if (!carte) return;
      const cible = {
        center: [spot.lon, spot.lat],
        zoom: Math.max(carte.getZoom(), ZOOM_SPOT),
        pitch: INCLINAISON_SPOT,
        bearing: spot.orientation ?? 270,   // on regarde la mer depuis la plage
      };
      if (reduit) carte.jumpTo(cible);
      else carte.flyTo({ ...cible, duration: 1800 });
    }

    function masquerCarte() {
      zoneCarte.hidden = true;
      racine.querySelector(".carte-grille").classList.add("carte-grille--sans-carte");
    }

    function chargerBibliotheque() {
      const dossier = racine.dataset.vendor;
      const feuille = document.createElement("link");
      feuille.rel = "stylesheet";
      feuille.href = `${dossier}/maplibre-gl.css`;
      document.head.appendChild(feuille);
      const script = document.createElement("script");
      script.src = `${dossier}/maplibre-gl.js`;
      script.onload = creerCarte;
      script.onerror = masquerCarte;
      document.head.appendChild(script);
    }

    function creerCarte() {
      if (!window.maplibregl || !webglDisponible()) {
        masquerCarte();
        return;
      }

      carte = new maplibregl.Map({
        container: "carte-gl",
        style: racine.dataset.style,
        center: [-1.2, 45.2],
        zoom: 8.6,
        minZoom: 6.5,
        maxZoom: 17.5,
        maxPitch: 65,
        cooperativeGestures: true,          // la molette et un seul doigt continuent de faire défiler la page
        locale: TEXTES_GESTES,
        attributionControl: {
          compact: false,
          customAttribution: 'Fond de carte © <a href="https://www.ign.fr/" rel="noopener">IGN</a>',
        },
      });
      carte.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

      carte.on("load", () => {
        const premierTexte = carte.getStyle().layers.find((c) => c.type === "symbol")?.id;

        carte.addSource("satellite", {
          type: "raster",
          tiles: [SATELLITE_IGN],
          tileSize: 256,
          maxzoom: 18,
          attribution: "Photographies aériennes © IGN",
        });
        carte.addLayer({
          id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" },
        }, premierTexte);

        // Au large, les photographies aériennes s'arrêtent net : un voile couleur mer masque cette limite
        carte.addSource("masque-large", { type: "geojson", data: masqueLarge() });
        carte.addLayer({
          id: "masque-large",
          type: "fill",
          source: "masque-large",
          layout: { visibility: "none" },
          paint: { "fill-color": COULEUR_MER, "fill-opacity": ["get", "opacite"] },
        }, premierTexte);

        carte.addSource("houle", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        carte.addLayer({
          id: "houle",
          type: "line",
          source: "houle",
          maxzoom: 12.5,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#DCEBE8", "line-opacity": 0.3, "line-width": 1.4 },
        }, premierTexte);

        voirTout();
        afficherHoule();
        animerHoule();
      });

      carte.on("render", placerEtiquettes);
      carte.on("error", (evenement) => {
        // Une tuile manquante n'empêche pas d'utiliser la carte
        if (evenement.error && !evenement.tile) console.warn(evenement.error.message);
      });

      new ResizeObserver(() => {
        carte.resize();
        placerEtiquettes();
      }).observe(document.getElementById("carte-gl"));

      new IntersectionObserver(([entree]) => {
        carteVisible = entree.isIntersecting;
      }).observe(document.getElementById("carte-gl"));
    }

    racine.querySelector(".carte-fonds").addEventListener("click", (evenement) => {
      const bouton = evenement.target.closest("button");
      if (!bouton || !carte || !carte.getLayer("satellite")) return;
      const satellite = bouton.dataset.fond === "satellite";
      ["satellite", "masque-large"].forEach((couche) => {
        carte.setLayoutProperty(couche, "visibility", satellite ? "visible" : "none");
      });
      // Les photos s'arrêtent au large : le fond passe à la couleur de la mer pour éviter les trous
      const fond = satellite ? COULEUR_MER : COULEUR_TERRE;
      carte.setPaintProperty("fond", "background-color", fond);
      carte.setPaintProperty("bckgrd", "fill-color", fond);
      racine.querySelectorAll(".carte-fonds button").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === bouton));
      });
    });


    /* 5. Étiquettes : rangées dans l'océan, chacune reliée à sa plage par un trait */

    const HAUTEUR_ETIQUETTE = 28;
    const ESPACE_ETIQUETTES = 4;
    const HAUT_LIBRE = 46;     // place laissée à l'indication de houle

    const CLASSE_NOTE = { 2: "good", 1: "warn", 0: "neutral", "-1": "neutral" };

    spots.forEach((spot) => {
      spot.etiquette = document.createElement("button");
      spot.etiquette.type = "button";
      spot.etiquette.className = "carte-etiquette";
      spot.etiquette.addEventListener("click", () => choisir(spot, true));
      zoneEtiquettes.appendChild(spot.etiquette);

      const espaceSvg = "http://www.w3.org/2000/svg";
      spot.liaison = document.createElementNS(espaceSvg, "line");
      spot.point = document.createElementNS(espaceSvg, "circle");
      spot.halo = document.createElementNS(espaceSvg, "circle");
      spot.halo.setAttribute("class", "carte-halo");
      spot.halo.setAttribute("r", "7");
      zoneLiaisons.append(spot.liaison, spot.halo, spot.point);
    });

    function afficherEtiquettes(actif) {
      spots.forEach((spot) => {
        const note = noteDe(spot);
        const analyse = analyser(spot, jourChoisi);
        const verdict = analyse ? VERDICTS[note] : null;
        const choisi = spot === actif;
        const taille = analyse ? `${nombre(analyse.repere.hauteur)} m` : "–";

        spot.etiquette.className = `carte-etiquette carte-etiquette--${CLASSE_NOTE[note]}${choisi ? " is-choisi" : ""}`;
        spot.etiquette.setAttribute("aria-pressed", String(choisi));
        spot.etiquette.setAttribute("aria-label", `${spot.nom} : ${verdict ? verdict.nom : "plus d'heure de jour"}, ${taille} au bord`);
        spot.etiquette.innerHTML = `${verdict ? icone(verdict.icone, "icon") : ""}<span>${spot.court}</span><b>${taille}</b>`;
        spot.largeur = spot.etiquette.offsetWidth;

        spot.point.setAttribute("r", choisi ? "6" : "4.5");
        spot.point.setAttribute("fill", verdict ? verdict.couleur : "#fff");
        spot.point.setAttribute("stroke", "#fff");
        spot.point.setAttribute("stroke-width", "2");
        spot.halo.style.display = choisi ? "" : "none";
      });
      placerEtiquettes();
    }

    function placerEtiquettes() {
      if (!carte) return;
      const conteneur = carte.getContainer();
      const W = conteneur.clientWidth;
      const H = conteneur.clientHeight;

      const visibles = [];
      spots.forEach((spot) => {
        const p = carte.project([spot.lon, spot.lat]);
        const dedans = p.x > -4 && p.x < W + 4 && p.y > -4 && p.y < H + 4;
        spot.visible = dedans;
        spot.etiquette.style.visibility = dedans ? "visible" : "hidden";
        [spot.liaison, spot.point, spot.halo].forEach((e) => { e.style.visibility = dedans ? "visible" : "hidden"; });
        if (dedans) {
          spot.px = p.x;
          spot.py = p.y;
          visibles.push(spot);
        }
      });
      if (!visibles.length) return;

      // Colonne à gauche des plages ; si la place manque, à droite
      const largeurMax = Math.max(...visibles.map((s) => s.largeur || 120));
      const plusAGauche = Math.min(...visibles.map((s) => s.px));
      const plusADroite = Math.max(...visibles.map((s) => s.px));
      const aGauche = plusAGauche - 30 - largeurMax >= 6 || plusADroite + 30 + largeurMax > W;
      const colonne = aGauche ? Math.max(largeurMax + 6, plusAGauche - 30) : plusADroite + 30;

      // Empile sans chevauchement, en restant au plus près de chaque plage
      const pas = HAUTEUR_ETIQUETTE + ESPACE_ETIQUETTES;
      const rangees = [...visibles].sort((a, b) => a.py - b.py);
      rangees.forEach((s, i) => {
        const voulu = s.py - HAUTEUR_ETIQUETTE / 2;
        s.ey = Math.max(voulu, HAUT_LIBRE, i ? rangees[i - 1].ey + pas : HAUT_LIBRE);
      });
      const basMax = H - HAUTEUR_ETIQUETTE - 28;
      for (let i = rangees.length - 1; i >= 0; i--) {
        const borne = i === rangees.length - 1 ? basMax : rangees[i + 1].ey - pas;
        rangees[i].ey = Math.min(rangees[i].ey, borne);
      }

      rangees.forEach((s) => {
        const largeur = s.largeur || 120;
        const gauche = aGauche ? colonne - largeur : colonne;
        s.etiquette.style.transform = `translate(${gauche.toFixed(1)}px, ${s.ey.toFixed(1)}px)`;
        s.liaison.setAttribute("x1", colonne.toFixed(1));
        s.liaison.setAttribute("y1", (s.ey + HAUTEUR_ETIQUETTE / 2).toFixed(1));
        s.liaison.setAttribute("x2", s.px.toFixed(1));
        s.liaison.setAttribute("y2", s.py.toFixed(1));
        [s.point, s.halo].forEach((e) => {
          e.setAttribute("cx", s.px.toFixed(1));
          e.setAttribute("cy", s.py.toFixed(1));
        });
      });
    }


    /* 6. Houle animée : direction, période et force viennent des prévisions du jour */

    let carteVisible = true;

    // Trait de côte simplifié : les vagues s'arrêtent à la plage (latitude, longitude)
    const COTE = [
      [44.2, -1.29], [44.62, -1.27],
      ...spots.map((s) => [s.lat, s.lon - 0.012]).sort((a, b) => a[0] - b[0]),
      [45.62, -1.2], [45.76, -1.32],
    ];

    // Trois bandes de plus en plus opaques, pour un passage progressif vers la pleine mer
    function masqueLarge() {
      const bandes = [[0.001, 0.4], [0.004, 0.75], [0.007, 1]];
      return {
        type: "FeatureCollection",
        features: bandes.map(([ecart, opacite]) => ({
          type: "Feature",
          properties: { opacite },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [-4, COTE[0][0]],
              ...COTE.map(([lat, lon]) => [lon - ecart, lat]),
              [-4, COTE[COTE.length - 1][0]],
              [-4, COTE[0][0]],
            ]],
          },
        })),
      };
    }

    function longitudeCote(lat) {
      for (let i = 1; i < COTE.length; i++) {
        if (lat <= COTE[i][0]) {
          const [la0, lo0] = COTE[i - 1];
          const [la1, lo1] = COTE[i];
          return lo0 + (lo1 - lo0) * (lat - la0) / (la1 - la0 || 1);
        }
      }
      return null;
    }

    function houleDuJour() {
      const ref = spots.find((s) => s.slug === "hourtin-plage" && s.analyse) || reference;
      const analyse = analyser(ref, jourChoisi);
      const heure = analyse
        ? analyse.repere
        : ref.analyse.heures.find((x) => x.jour === jourChoisi && x.heure === 12);
      return heure && heure.direction != null && heure.periode != null ? heure : null;
    }

    function afficherHoule() {
      houle = houleDuJour();
      if (!houle) {
        zoneHoule.hidden = true;
        return;
      }
      zoneHoule.hidden = false;
      zoneHoule.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${(houle.direction + 180) % 360}deg)"><path d="M12 20V4"/><path d="m5 11 7-7 7 7"/></svg>
        <span>Houle<span class="carte-houle-long"> du large</span> : ${cardinal(houle.direction)}, ${nombre(houle.houle)} m, ${nombre(houle.periode, 0)} s</span>`;
      if (carte && carte.getLayer("houle")) {
        const force = Math.min(houle.houle / 2.5, 1);
        carte.setPaintProperty("houle", "line-opacity", 0.16 + 0.42 * force);
        carte.setPaintProperty("houle", "line-width", 0.9 + (houle.periode / 16) * 1.6);
        dessinerHoule(reduit ? 0.4 : performance.now() / 1000);
      }
    }

    function dessinerHoule(temps) {
      if (!houle || !carte.getSource("houle")) return;
      const propagation = ((houle.direction + 180) % 360) * Math.PI / 180;
      const echelleLon = 1 / Math.cos(45 * Math.PI / 180);
      const px = Math.sin(propagation) * echelleLon;
      const py = Math.cos(propagation);
      const qx = Math.cos(propagation) * echelleLon;
      const qy = -Math.sin(propagation);

      const espacement = 0.05 + houle.periode * 0.009;   // plus la période est longue, plus les vagues sont espacées
      const phase = (temps * 0.1) % 1;
      const nombreLignes = Math.ceil(1.4 / espacement);
      const lignes = [];

      for (let k = -nombreLignes; k <= nombreLignes; k++) {
        let courante = [];
        for (let u = -1.6; u <= 1.6; u += 0.035) {
          const s = (k + phase) * espacement + 0.012 * Math.sin(u * 7 + k * 1.3);
          const lon = -1.75 + px * s + qx * u;
          const lat = 45 + py * s + qy * u;
          const cote = lat > 44.2 && lat < 45.76 ? longitudeCote(lat) : null;
          if (cote !== null && lon < cote) {
            courante.push([lon, lat]);
          } else if (courante.length) {
            if (courante.length > 1) lignes.push(courante);
            courante = [];
          }
        }
        if (courante.length > 1) lignes.push(courante);
      }

      carte.getSource("houle").setData({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: lignes } });
    }

    function animerHoule() {
      if (reduit) return;
      let dernier = 0;
      const boucle = (instant) => {
        if (carteVisible && carte.getZoom() < 12.5 && instant - dernier > 1000 / FPS_HOULE) {
          dernier = instant;
          dessinerHoule(instant / 1000);
        }
        requestAnimationFrame(boucle);
      };
      requestAnimationFrame(boucle);
    }


    afficher();
    afficherNote();

    // La bibliothèque de carte pèse lourd : on ne la charge qu'à l'approche de la section
    const approche = new IntersectionObserver((entrees) => {
      if (entrees.some((e) => e.isIntersecting)) {
        approche.disconnect();
        chargerBibliotheque();
      }
    }, { rootMargin: "500px" });
    approche.observe(zoneCarte);
  }
})();
