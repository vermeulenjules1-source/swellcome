/* ==========================================================================
   Swellcome — scripts du site
   1. Menu mobile
   2. Formulaire newsletter
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
