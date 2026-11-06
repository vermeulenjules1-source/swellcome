"""
Construit le site Swellcome dans le dossier dist/.

Ce que fait le script, dans l'ordre :
  1. Copie les fichiers statiques (CSS, JS, polices, images) de site/assets/.
  2. Lit les fiches spots de data/spots/ (un fichier JSON par spot).
  3. Assemble chaque page de site/pages/ avec le header, le footer et le gabarit.
  4. Génère une page par spot à partir de site/templates/spot.html.

Utilisation (depuis la racine du dépôt) :
    python3 scripts/build.py
    python3 -m http.server 8000 -d dist     # puis ouvrir http://localhost:8000

Aucune bibliothèque à installer : uniquement Python 3.
"""

import html
import json
import os
import re
import shutil
from datetime import date
from pathlib import Path


# --- Réglages ---------------------------------------------------------------

# Préfixe des liens. Vide en local. Pour GitHub Pages sans nom de domaine,
# le site est servi sous /swellcome : lancer avec SWELLCOME_BASE=/swellcome.
BASE = os.environ.get("SWELLCOME_BASE", "").rstrip("/")

# Adresse d'envoi du formulaire newsletter (formulaire Brevo, par exemple).
# Tant qu'elle est vide, le formulaire n'envoie rien et affiche un message.
NEWSLETTER_ACTION = ""

RACINE = Path(__file__).resolve().parent.parent
SITE = RACINE / "site"
SORTIE = RACINE / "dist"


# --- Outils -----------------------------------------------------------------

def lire(chemin):
    return chemin.read_text(encoding="utf-8")


def ecrire(chemin_relatif, contenu):
    """Écrit un fichier dans dist/, en créant les dossiers si besoin."""
    chemin = SORTIE / chemin_relatif
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(contenu, encoding="utf-8")


def remplacer(texte, valeurs):
    """Remplace chaque {{cle}} du texte par sa valeur."""
    for cle, valeur in valeurs.items():
        texte = texte.replace("{{" + cle + "}}", str(valeur))
    return texte


def e(texte):
    """Protège un texte avant de l'insérer dans du HTML."""
    return html.escape(str(texte))


def lire_entete(contenu):
    """
    Lit l'en-tête placé en haut de chaque page, sous la forme :
        <!--
        titre: Mon titre
        description: Ma description
        -->
    Renvoie (infos, reste_du_contenu).
    """
    correspondance = re.match(r"\s*<!--(.*?)-->", contenu, re.S)
    infos = {}
    if not correspondance:
        return infos, contenu
    for ligne in correspondance.group(1).strip().splitlines():
        if ":" in ligne:
            cle, valeur = ligne.split(":", 1)
            infos[cle.strip()] = valeur.strip()
    return infos, contenu[correspondance.end():]


# --- Fiches spots -----------------------------------------------------------

def charger_spots():
    """Lit toutes les fiches et les trie du nord au sud."""
    spots = [json.loads(lire(f)) for f in sorted((RACINE / "data" / "spots").glob("*.json"))]
    return sorted(spots, key=lambda s: (s["departement"], s["ordre_nord_sud"]))


def url_spot(spot):
    return f"{BASE}/{spot['departement_slug']}/{spot['slug']}/"


def liste_spots_html(spots):
    """Liste des spots le long de la côte, pour les pages Spots et Gironde."""
    lignes = []
    for spot in spots:
        lignes.append(f"""      <li>
        <a class="spot-link" href="{url_spot(spot)}">
          <span>
            <span class="spot-title">{e(spot['nom'])}</span><br>
            <span class="spot-commune">{e(spot['commune'])}</span>
          </span>
          <span class="spot-meta">
            <span class="badge badge--neutral">Fiche en cours</span>
            <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg>
          </span>
        </a>
      </li>""")
    return "    <ol class=\"coast-list\">\n" + "\n".join(lignes) + "\n    </ol>"


# Libellés affichés dans la fiche, dans l'ordre. None = champ à renseigner.
CHAMPS_FICHE = [
    ("orientation_16", "Orientation de la plage"),
    ("fond", "Type de fond"),
    ("type_vague", "Type de vague"),
    ("maree_favorable", "Marée qui fonctionne"),
    ("fenetre_houle", "Houle qui fonctionne"),
    ("vent_ideal", "Vent idéal"),
    ("niveau_minimal", "Niveau minimal conseillé"),
    ("surveillance", "Surveillance"),
    ("acces_parking", "Accès et parking"),
]


def fiche_html(spot):
    lignes = []
    for cle, libelle in CHAMPS_FICHE:
        valeur = spot.get(cle)
        if valeur:
            dd = e(valeur)
        else:
            dd = '<span class="empty">À renseigner</span>'
        lignes.append(f"        <div><dt>{libelle}</dt><dd>{dd}</dd></div>")

    dangers = ", ".join(spot.get("dangers") or [])
    dd = e(dangers) if dangers else '<span class="empty">À renseigner</span>'
    lignes.append(f"        <div><dt>Dangers</dt><dd>{dd}</dd></div>")
    return "      <dl class=\"fact-list\">\n" + "\n".join(lignes) + "\n      </dl>"


def lien_voisin(spot, sens):
    """Lien vers le spot précédent (au nord) ou suivant (au sud)."""
    if spot is None:
        return "<span></span>"
    if sens == "nord":
        return (f'<a href="{url_spot(spot)}"><small>Au nord</small>'
                f'<svg class="icon" aria-hidden="true"><use href="#i-arrow-left"></use></svg> {e(spot["nom"])}</a>')
    return (f'<a href="{url_spot(spot)}" style="text-align:right"><small>Au sud</small>'
            f'{e(spot["nom"])} <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg></a>')


# --- Assemblage -------------------------------------------------------------

def page_complete(gabarit, morceaux, infos, contenu):
    """Assemble une page : gabarit + header + contenu + footer."""
    header = morceaux["header"]
    # Met en valeur l'entrée du menu correspondant à la page courante
    if infos.get("nav"):
        header = header.replace(f'data-nav="{infos["nav"]}"',
                                f'data-nav="{infos["nav"]}" aria-current="page"')
    page = remplacer(gabarit, {
        "titre": e(infos.get("titre", "Swellcome")),
        "description": e(infos.get("description", "")),
        "icones": morceaux["icones"],
        "header": header,
        "footer": morceaux["footer"],
        "contenu": contenu,
    })
    # Les {{...}} des partials et du contenu sont remplacés en dernier
    return remplacer(page, morceaux["communs"])


def construire():
    # 1. Repart d'un dossier dist/ vide et copie les fichiers statiques
    if SORTIE.exists():
        shutil.rmtree(SORTIE)
    shutil.copytree(SITE / "assets", SORTIE / "assets")

    # 2. Données
    spots = charger_spots()
    gironde = [s for s in spots if s["departement_slug"] == "gironde"]

    communs = {
        "base": BASE,
        "annee": date.today().year,
        "newsletter_action": e(NEWSLETTER_ACTION),
        "nombre_spots": len(spots),
        "liste_spots_gironde": liste_spots_html(gironde),
    }
    morceaux = {
        "icones": lire(SITE / "partials" / "icons.html"),
        "header": lire(SITE / "partials" / "header.html"),
        "footer": lire(SITE / "partials" / "footer.html"),
        "communs": communs,
    }
    gabarit = lire(SITE / "templates" / "base.html")

    # 3. Pages éditoriales : site/pages/nom.html devient dist/nom/index.html
    nb_pages = 0
    for fichier in sorted((SITE / "pages").glob("*.html")):
        infos, contenu = lire_entete(lire(fichier))
        if fichier.stem == "index":
            destination = "index.html"
        elif fichier.stem == "404":
            destination = "404.html"
        else:
            destination = f"{fichier.stem}/index.html"
        ecrire(destination, page_complete(gabarit, morceaux, infos, contenu))
        nb_pages += 1

    # 4. Une page par spot
    modele_spot = lire(SITE / "templates" / "spot.html")
    for spot in spots:
        voisins_meme_dept = [s for s in spots if s["departement_slug"] == spot["departement_slug"]]
        j = voisins_meme_dept.index(spot)
        au_nord = voisins_meme_dept[j - 1] if j > 0 else None
        au_sud = voisins_meme_dept[j + 1] if j + 1 < len(voisins_meme_dept) else None

        lat, lon = spot["coordonnees"]["lat"], spot["coordonnees"]["lon"]
        contenu = remplacer(modele_spot, {
            "nom": e(spot["nom"]),
            "commune": e(spot["commune"]),
            "departement": e(spot["departement"]),
            "departement_slug": spot["departement_slug"],
            "fiche": fiche_html(spot),
            "description": e(spot["description"]) if spot.get("description") else
                "La fiche détaillée de ce spot est en cours de rédaction : orientation, fond, marée qui fonctionne et niveau conseillé seront relevés sur le terrain.",
            "lien_carte": f"https://www.openstreetmap.org/?mlat={lat}&amp;mlon={lon}#map=14/{lat}/{lon}",
            "verifie_le": e(spot["verifie_le"]) if spot.get("verifie_le") else "pas encore vérifiée",
            "precedent": lien_voisin(au_nord, "nord"),
            "suivant": lien_voisin(au_sud, "sud"),
        })
        infos = {
            "titre": f"Surf à {spot['nom']} ({spot['commune']}) : prévisions et fiche spot | Swellcome",
            "description": f"Prévisions surf pour {spot['nom']}, à {spot['commune']} ({spot['departement']}) : houle, vent, marée et conseils selon votre niveau.",
            "nav": "spots",
        }
        ecrire(f"{spot['departement_slug']}/{spot['slug']}/index.html",
               page_complete(gabarit, morceaux, infos, contenu))

    print(f"Site construit dans {SORTIE.relative_to(RACINE)}/ : "
          f"{nb_pages} pages et {len(spots)} fiches spots.")


if __name__ == "__main__":
    construire()
