/* ==========================================================================
   Swellcome — scripts du site
   1. Menu mobile
   2. Formulaire newsletter
   3. Vidéo du bandeau
   4. Onglets des fiches spots
   ========================================================================== */


/* 1. Menu mobile : ouvre et ferme la navigation sur petit écran */

const boutonMenu = document.querySelector(".nav-toggle");
const menu = document.querySelector(".main-nav");

if (boutonMenu && menu) {
  boutonMenu.addEventListener("click", () => {
    const ouvert = menu.classList.toggle("is-open");
    boutonMenu.setAttribute("aria-expanded", ouvert);
    boutonMenu.querySelector("use").setAttribute("href", ouvert ? "#i-close" : "#i-menu");
  });

  // Referme le menu quand on clique sur un lien (utile pour l'ancre #newsletter)
  menu.querySelectorAll("a").forEach((lien) => {
    lien.addEventListener("click", () => {
      menu.classList.remove("is-open");
      boutonMenu.setAttribute("aria-expanded", "false");
      boutonMenu.querySelector("use").setAttribute("href", "#i-menu");
    });
  });
}


/* 2. Newsletter : vérifie le formulaire avant l'envoi */

document.querySelectorAll("[data-newsletter]").forEach((formulaire) => {
  const message = formulaire.querySelector(".form-message");

  function afficher(texte, type) {
    message.textContent = texte;
    message.className = "form-message is-" + type;
  }

  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();

    const email = formulaire.querySelector('input[type="email"]');
    const consentement = formulaire.querySelector('input[name="OPT_IN"]');

    if (!email.value || !email.checkValidity()) {
      afficher("Indiquez une adresse email valide.", "error");
      email.focus();
      return;
    }
    if (!consentement.checked) {
      afficher("Cochez la case pour accepter de recevoir la newsletter.", "error");
      consentement.focus();
      return;
    }

    // Aucun service d'envoi configuré pour l'instant (voir NEWSLETTER_ACTION dans build.py)
    const adresse = formulaire.getAttribute("action");
    if (!adresse) {
      afficher("Les inscriptions ouvrent très bientôt. Merci de votre intérêt !", "success");
      return;
    }

    try {
      await fetch(adresse, { method: "POST", body: new FormData(formulaire), mode: "no-cors" });
      afficher("Merci ! Confirmez votre inscription grâce à l'email que vous allez recevoir.", "success");
      formulaire.reset();
    } catch (erreur) {
      afficher("L'inscription n'a pas pu être envoyée. Réessayez dans un instant.", "error");
    }
  });
});


/* 3. Vidéo du bandeau : à l'arrêt si le visiteur a demandé moins d'animations */

const video = document.querySelector(".hero-video");

if (video) {
  const bandeau = video.closest(".hero");

  // Si le navigateur ne sait pas lire la vidéo, on revient à l'animation de vagues
  const revenirAuxVagues = () => {
    bandeau.classList.remove("hero--video");
    video.remove();
  };

  if (!video.canPlayType('video/webm; codecs="vp9"')) {
    revenirAuxVagues();
  } else {
    video.querySelector("source").addEventListener("error", revenirAuxVagues);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      video.removeAttribute("autoplay");
    } else {
      video.play().catch(() => { /* lecture automatique refusée : la première image reste affichée */ });
    }
  }
}


/* 4. Onglets des fiches spots : l'adresse garde l'onglet ouvert (#le-spot, #conseils) */

const barreOnglets = document.querySelector("[data-onglets]");

if (barreOnglets) {
  const onglets = [...barreOnglets.querySelectorAll('[role="tab"]')];

  function ouvrir(onglet, majAdresse) {
    onglets.forEach((autre) => {
      const actif = autre === onglet;
      autre.setAttribute("aria-selected", String(actif));
      autre.tabIndex = actif ? 0 : -1;
      document.getElementById(autre.getAttribute("aria-controls")).hidden = !actif;
    });
    if (majAdresse) {
      const nom = onglet.id.replace("onglet-", "");
      history.replaceState(null, "", nom === "previsions" ? window.location.pathname : `#${nom}`);
    }
  }

  onglets.forEach((onglet, rang) => {
    onglet.addEventListener("click", () => ouvrir(onglet, true));
    onglet.addEventListener("keydown", (evenement) => {
      const pas = { ArrowRight: 1, ArrowLeft: -1 }[evenement.key];
      if (!pas) return;
      const suivant = onglets[(rang + pas + onglets.length) % onglets.length];
      ouvrir(suivant, true);
      suivant.focus();
    });
  });

  const demande = document.getElementById(`onglet-${window.location.hash.slice(1)}`);
  ouvrir(onglets.includes(demande) ? demande : onglets[0], false);
}
