/* ==========================================================================
   Swellcome — barre « Trouve ton spot »
   Propose les spots qui correspondent aux lettres tapées, sans tenir compte
   des accents ni des majuscules, et tolère une faute de frappe.
   La liste des spots est écrite dans la page par build.py (balise #donnees-recherche).
   ========================================================================== */

(function () {
  const formulaire = document.querySelector("[data-recherche]");
  const source = document.getElementById("donnees-recherche");
  if (!formulaire || !source) return;

  const champ = formulaire.querySelector("input");
  const liste = formulaire.querySelector("[role='listbox']");
  const SUGGESTIONS_MAX = 12;
  let resultats = [];
  let rangActif = -1;

  // « Lège-Cap Ferret » devient « lege cap ferret »
  const normaliser = (texte) => texte
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const echapper = (texte) => texte.replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const spots = JSON.parse(source.textContent).map((spot) => {
    const nom = normaliser(spot.nom);
    const autres = normaliser([spot.commune, spot.departement, ...spot.autres].join(" "));
    return { ...spot, nomCherche: nom, motsNom: nom.split(" "), motsAutres: autres.split(" ") };
  });

  // Vrai si les deux mots ne diffèrent que d'une lettre (oubliée, en trop ou fausse)
  function uneFaute(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let fautes = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i += 1;
        j += 1;
        continue;
      }
      fautes += 1;
      if (fautes > 1) return false;
      if (a.length > b.length) i += 1;
      else if (b.length > a.length) j += 1;
      else {
        i += 1;
        j += 1;
      }
    }
    return fautes + (a.length - i) + (b.length - j) <= 1;
  }

  // Note d'un mot tapé : plus elle est basse, meilleure est la proposition. null si rien ne colle.
  function noterMot(mot, spot) {
    if (spot.nomCherche.startsWith(mot)) return 0;
    if (spot.motsNom.some((x) => x.startsWith(mot))) return 1;
    if (spot.motsAutres.some((x) => x.startsWith(mot))) return 2;
    if (spot.nomCherche.includes(mot)) return 3;
    // Une faute n'est tolérée qu'à partir de 3 lettres, sinon tout correspondrait
    if (mot.length >= 3) {
      const debut = (x) => x.slice(0, mot.length);
      if ([...spot.motsNom, ...spot.motsAutres].some((x) => uneFaute(mot, x) || uneFaute(mot, debut(x)))) return 4;
    }
    return null;
  }

  function chercher(texte) {
    const mots = normaliser(texte).split(" ").filter(Boolean);
    if (!mots.length) return spots.slice(0, SUGGESTIONS_MAX);
    return spots
      .map((spot) => {
        const notes = mots.map((mot) => noterMot(mot, spot));
        return notes.includes(null) ? null : { spot, note: notes.reduce((a, b) => a + b, 0) };
      })
      .filter(Boolean)
      .sort((a, b) => a.note - b.note || a.spot.nom.localeCompare(b.spot.nom, "fr"))
      .slice(0, SUGGESTIONS_MAX)
      .map((x) => x.spot);
  }

  // Met en gras les lettres tapées dans le nom affiché
  function surligner(nom, texte) {
    const mots = normaliser(texte).split(" ").filter(Boolean);
    const lettres = [...nom].map((c) => normaliser(c) || " ");
    const marquees = new Array(lettres.length).fill(false);
    const cherche = lettres.join("");
    mots.forEach((mot) => {
      const position = cherche.indexOf(mot);
      if (position >= 0) marquees.fill(true, position, position + mot.length);
    });
    return [...nom].map((c, i) => (marquees[i] ? `<mark>${echapper(c)}</mark>` : echapper(c))).join("");
  }

  function fermer() {
    liste.hidden = true;
    champ.setAttribute("aria-expanded", "false");
    champ.removeAttribute("aria-activedescendant");
    rangActif = -1;
  }

  function afficher() {
    resultats = chercher(champ.value);
    rangActif = -1;
    champ.removeAttribute("aria-activedescendant");
    liste.innerHTML = resultats.length
      ? resultats.map((spot, i) => `
        <li role="option" id="suggestion-${i}" aria-selected="false">
          <a href="${echapper(spot.url)}" tabindex="-1">
            ${spot.vignette ? `<img src="${echapper(spot.vignette)}" alt="" width="44" height="44" loading="lazy">` : ""}
            <span class="recherche-texte">
              <strong>${surligner(spot.nom, champ.value)}</strong>
              <small>${echapper(spot.commune)}, ${echapper(spot.departement)}</small>
            </span>
          </a>
        </li>`).join("")
      : `<li class="recherche-vide">Rien pour « ${echapper(champ.value.trim())} ». Ou alors c'est un secret de local.</li>`;
    liste.hidden = false;
    champ.setAttribute("aria-expanded", "true");
  }

  function activer(rang) {
    const options = [...liste.querySelectorAll("[role='option']")];
    if (!options.length) return;
    rangActif = (rang + options.length) % options.length;
    options.forEach((option, i) => option.setAttribute("aria-selected", String(i === rangActif)));
    champ.setAttribute("aria-activedescendant", options[rangActif].id);
    options[rangActif].scrollIntoView({ block: "nearest" });
  }

  champ.addEventListener("input", afficher);
  champ.addEventListener("focus", afficher);

  champ.addEventListener("keydown", (evenement) => {
    if (evenement.key === "ArrowDown") {
      evenement.preventDefault();
      if (liste.hidden) afficher();
      activer(rangActif + 1);
    } else if (evenement.key === "ArrowUp") {
      evenement.preventDefault();
      if (liste.hidden) afficher();
      activer(rangActif - 1);
    } else if (evenement.key === "Escape") {
      fermer();
    }
  });

  formulaire.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    const choix = resultats[Math.max(rangActif, 0)];
    if (choix && !liste.hidden) window.location.href = choix.url;
  });

  document.addEventListener("click", (evenement) => {
    if (!formulaire.contains(evenement.target)) fermer();
  });
})();
