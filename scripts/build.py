"""
Construit le site Swellcome dans le dossier dist/.

Ce que fait le script, dans l'ordre :
  1. Copie les fichiers statiques (CSS, JS, polices, images) de site/assets/.
  2. Lit les fiches spots de data/spots/ (un fichier JSON par spot).
  3. Assemble chaque page de site/pages/ avec le header, le footer et le gabarit.
  4. Génère une page par spot à partir de site/templates/spot.html.
  5. Génère les articles de site/blog/ et le plan du site (sitemap.xml).

Les prévisions de data/forecast/ (écrites par scripts/collecte.py) sont insérées
dans chaque fiche spot ; site/assets/js/forecast.js les affiche.

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

# Adresse publique du site, pour les liens canoniques et le sitemap.
SITE_URL = "https://vermeulenjules1-source.github.io"

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


MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]


def date_fr(iso):
    """Transforme 2026-11-09 en 9 novembre 2026."""
    annee, mois, jour = iso.split("-")
    return f"{int(jour)} {MOIS[int(mois) - 1]} {annee}"


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


def vignette_html(spot):
    """Petite photo décorative : le nom du spot est déjà écrit à côté."""
    if not spot.get("photo"):
        return ""
    return (f'<img class="spot-vignette" src="{BASE}/assets/img/spots/vignettes/{e(spot["photo"]["fichier"])}" '
            f'alt="" width="64" height="64" loading="lazy">')


def liste_spots_html(spots):
    """Liste des spots le long de la côte, pour les pages Spots et Gironde."""
    lignes = []
    for spot in spots:
        lignes.append(f"""      <li>
        <a class="spot-link" href="{url_spot(spot)}">
          <span class="spot-identite">
            {vignette_html(spot)}
            <span>
              <span class="spot-title">{e(spot['nom'])}</span><br>
              <span class="spot-commune">{e(spot['commune'])}</span>
            </span>
          </span>
          <span class="spot-meta">
            <span class="badge badge--neutral">Plage orientée {e(spot['orientation_16'] or '?')}</span>
            <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg>
          </span>
        </a>
      </li>""")
    return "    <ol class=\"coast-list\">\n" + "\n".join(lignes) + "\n    </ol>"


# Libellés affichés dans la fiche, dans l'ordre. Un champ vide reste affiché « À confirmer ».
CHAMPS_FICHE = [
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
    if spot.get("orientation_deg") is not None:
        lignes.append(f"        <div><dt>Orientation de la plage</dt>"
                      f"<dd>{e(spot['orientation_16'])} ({spot['orientation_deg']}°)</dd></div>")
    if spot.get("saturation_m"):
        lignes.append(f"        <div><dt>Limite de taille</dt>"
                      f"<dd>Sature vers {decimale(spot['saturation_m']).replace(',0', '')} m de houle (retour local)</dd></div>")
    for cle, libelle in CHAMPS_FICHE:
        valeur = spot.get(cle)
        if valeur:
            dd = e(valeur)
        else:
            dd = '<span class="empty">À confirmer</span>'
        lignes.append(f"        <div><dt>{libelle}</dt><dd>{dd}</dd></div>")

    dangers = ", ".join(spot.get("dangers") or [])
    dd = e(dangers) if dangers else '<span class="empty">À confirmer</span>'
    lignes.append(f"        <div><dt>Dangers</dt><dd>{dd}</dd></div>")
    return "      <dl class=\"fact-list\">\n" + "\n".join(lignes) + "\n      </dl>"


def sources_html(spot):
    """Liste des sources affichée en bas de chaque fiche."""
    lignes = [f'        <li><a href="{e(s["url"])}" rel="noopener">{e(s["titre"])}</a> '
              f'<span class="muted">({e(s["porte_sur"])})</span></li>'
              for s in spot.get("sources") or []]
    return "      <ul>\n" + "\n".join(lignes) + "\n      </ul>"


def spots_proches(spot, spots, nombre=3):
    """Les spots les plus proches, pour le maillage entre les fiches."""
    autres = [s for s in spots if s["slug"] != spot["slug"]]
    autres.sort(key=lambda s: abs(s["coordonnees"]["lat"] - spot["coordonnees"]["lat"]))
    return autres[:nombre]


def lien_voisin(spot, sens):
    """Lien vers le spot précédent (au nord) ou suivant (au sud)."""
    if spot is None:
        return "<span></span>"
    if sens == "nord":
        return (f'<a href="{url_spot(spot)}"><small>Au nord</small>'
                f'<svg class="icon" aria-hidden="true"><use href="#i-arrow-left"></use></svg> {e(spot["nom"])}</a>')
    return (f'<a href="{url_spot(spot)}" style="text-align:right"><small>Au sud</small>'
            f'{e(spot["nom"])} <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg></a>')


def lien_licence(media):
    """Nom de la licence, avec un lien si l'adresse est connue."""
    if media.get("licence_url"):
        return f'<a href="{e(media["licence_url"])}" rel="noopener">{e(media["licence"])}</a>'
    return e(media["licence"])


def credit_html(media):
    return (f'{e(media["auteur"])}, {lien_licence(media)}, '
            f'<a href="{e(media["source"])}" rel="noopener">Wikimedia Commons</a>')


def photo_html(spot):
    photo = spot.get("photo")
    if not photo:
        return ""
    return f"""    <figure class="spot-photo">
      <img src="{BASE}/assets/img/spots/{e(photo['fichier'])}" alt="{e(photo['legende'])}" width="1280" height="853">
      <figcaption>{e(photo['legende'])}. Photo : {credit_html(photo)}, redimensionnée.</figcaption>
    </figure>"""


def credits_medias_html(spots, video):
    """Liste de toutes les photos et de la vidéo, avec auteur et licence."""
    lignes = [f'        <li><strong>{e(s["nom"])}</strong> : {credit_html(s["photo"])}.</li>'
              for s in spots if s.get("photo")]
    if video:
        lignes.append(f'        <li><strong>Vidéo du bandeau</strong> ({e(video["legende"])}) : {credit_html(video)}.</li>')
    return "      <ul>\n" + "\n".join(lignes) + "\n      </ul>"


# --- Webcams ----------------------------------------------------------------

def liens_webcams(spot):
    """Liens vers les pages officielles : aucune image de webcam n'est reprise ici."""
    lignes = []
    for cam in spot.get("webcams") or []:
        note = f'<small class="muted">{e(cam["note"])}</small>' if cam.get("note") else ""
        lignes.append(f"""          <li>
            <a href="{e(cam['url'])}" target="_blank" rel="noopener">
              {e(cam['nom'])}
              <svg class="icon" aria-hidden="true"><use href="#i-external"></use></svg>
              <span class="visually-hidden">(nouvelle fenêtre)</span>
            </a>
            <small class="muted">{e(cam['exploitant'])}</small>
            {note}
          </li>""")
    return '        <ul class="webcam-liens">\n' + "\n".join(lignes) + "\n        </ul>"


def webcam_fiche_html(spot):
    if spot.get("webcams"):
        return liens_webcams(spot)
    return ('        <p class="muted" style="font-size:0.9rem;margin:0">Pas de webcam publique repérée pour ce spot. '
            f'<a href="{BASE}/webcams/">Voir les webcams de la côte</a>.</p>')


def page_webcams_html(spots):
    cartes = []
    for spot in spots:
        contenu = (liens_webcams(spot) if spot.get("webcams")
                   else '        <p class="muted" style="margin:0">Pas de webcam publique repérée pour l\'instant.</p>')
        cartes.append(f"""      <article class="card webcam-carte">
        <h3>{vignette_html(spot)}<a href="{url_spot(spot)}">{e(spot['nom'])}</a></h3>
{contenu}
      </article>""")
    return '    <div class="grid grid--2">\n' + "\n".join(cartes) + "\n    </div>"


# --- Prévisions -------------------------------------------------------------

def charger_prevision(slug):
    chemin = RACINE / "data" / "forecast" / f"{slug}.json"
    return json.loads(lire(chemin)) if chemin.exists() else None


def decimale(x):
    return f"{x:.1f}".replace(".", ",")


def resume_prevision(prevision):
    """Résumé par jour : visible sans JavaScript et lisible par les moteurs de recherche."""
    h = prevision["heures"]
    soleil = prevision["soleil"]
    lignes = []
    for jour, lever, coucher in zip(soleil["jours"], soleil["lever"], soleil["coucher"]):
        rangs = [i for i, t in enumerate(h["temps"]) if lever[:14] + "00" <= t <= coucher and t.startswith(jour)
                 and h["hauteur"][i] is not None and h["vent"][i] is not None]
        if not rangs:
            continue
        houles = [h["houle"][i] for i in rangs if h["houle"][i] is not None]
        if not houles:
            continue
        periodes = [h["periode"][i] for i in rangs if h["periode"][i] is not None]
        vent = sum(h["vent"][i] for i in rangs) / len(rangs)
        periode = f"{sum(periodes) / len(periodes):.0f} s" if periodes else "–"
        lignes.append(f"          <tr><td>{date_fr(jour)}</td><td>{decimale(min(houles))} à {decimale(max(houles))} m</td>"
                      f"<td>{periode}</td><td>{vent:.0f} km/h</td></tr>")
    return ('      <div class="table-wrap"><table class="data-table">\n'
            '        <thead><tr><th scope="col">Jour</th><th scope="col">Houle au large</th>'
            '<th scope="col">Période moyenne</th><th scope="col">Vent moyen</th></tr></thead>\n'
            "        <tbody>\n" + "\n".join(lignes) + "\n        </tbody>\n      </table></div>\n"
            f'      <p class="muted" style="font-size:0.85rem;margin-top:12px">Moyennes des heures de jour. Mis à jour le {e(prevision["mis_a_jour"][:10])} (UTC).</p>')


def apercu_carte(spots):
    """Données légères de la carte de l'accueil : 4 jours de prévisions par spot."""
    garder = ["temps", "houle", "periode", "direction", "houle2", "periode2", "direction2",
              "eau", "vent", "rafales", "vent_dir"]
    apercu = []
    for spot in spots:
        prevision = charger_prevision(spot["slug"])
        reduite = None
        if prevision:
            h, s = prevision["heures"], prevision["soleil"]
            reduite = {
                "mis_a_jour": prevision["mis_a_jour"],
                "heures": {cle: h[cle][:96] for cle in garder if cle in h},
                "soleil": {cle: s[cle][:4] for cle in ("jours", "lever", "coucher")},
            }
        photo = spot.get("photo")
        cams = spot.get("webcams") or []
        apercu.append({
            "slug": spot["slug"],
            "nom": spot["nom"],
            "commune": spot["commune"],
            "lat": spot["coordonnees"]["lat"],
            "lon": spot["coordonnees"]["lon"],
            "url": url_spot(spot),
            "vignette": f"{BASE}/assets/img/spots/vignettes/{photo['fichier']}" if photo else None,
            "orientation": spot.get("orientation_deg"),
            "saturation": spot.get("saturation_m"),
            "webcam": cams[0]["url"] if cams else None,
            "prevision": reduite,
        })
    return json.dumps(apercu, ensure_ascii=False, separators=(",", ":"))


def bloc_prevision(spot, prevision):
    """Le bloc de prévisions de la fiche, ou un message si la collecte n'a pas encore tourné."""
    if prevision is None:
        return """      <div class="forecast-pending">
        <span class="icon-wrap">
          <svg class="icon" aria-hidden="true"><use href="#i-waves"></use></svg>
        </span>
        <h3>Prévisions bientôt disponibles</h3>
        <p>Houle, période, vent et marée heure par heure, avec un verdict selon votre niveau : top, correct ou à oublier. <a href="{{base}}/comprendre-le-forecast/">Apprendre à lire un forecast</a>.</p>
      </div>"""
    donnees = {
        "spot": {"nom": spot["nom"], "orientation": spot.get("orientation_deg"), "saturation": spot.get("saturation_m")},
        "prevision": prevision,
    }
    # Le remplacement de la séquence fermante empêche de sortir de la balise script
    texte = json.dumps(donnees, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f"""      <div id="prevision" data-guide="{BASE}/comprendre-le-forecast/">
{resume_prevision(prevision)}
      </div>
      <script type="application/json" id="donnees-prevision">{texte}</script>
      <script src="{BASE}/assets/js/verdict.js" defer></script>
      <script src="{BASE}/assets/js/forecast.js" defer></script>"""


# --- Blog -------------------------------------------------------------------

# L'ordre de ce dictionnaire est celui des rubriques de la page Blog
CATEGORIES = {"guide": "Guides", "note": "Notes de spot", "actu": "Actus"}


def url_article(article):
    return f"{BASE}/blog/{article['slug']}/"


def charger_articles():
    """Lit site/blog/*.html, du plus récent au plus ancien. Un nom en _ est ignoré."""
    articles = []
    for fichier in (SITE / "blog").glob("*.html"):
        if fichier.name.startswith("_"):
            continue
        infos, corps = lire_entete(lire(fichier))
        infos["slug"] = fichier.stem
        infos["corps"] = corps
        infos["spots"] = [s.strip() for s in infos.get("spots", "").split(",") if s.strip()]
        articles.append(infos)
    return sorted(articles, key=lambda a: a["date"], reverse=True)


def carte_article(article):
    return f"""      <a class="article-card" href="{url_article(article)}">
        <span class="eyebrow">{CATEGORIES[article['categorie']]}</span>
        <h3>{e(article['titre'])}</h3>
        <p class="muted">{e(article['description'])}</p>
        <span class="article-date">{date_fr(article['date'])}</span>
      </a>"""


def grille_articles(articles, vide="Les premiers articles arrivent bientôt."):
    if not articles:
        return f'    <p class="muted">{vide}</p>'
    return '    <div class="grid grid--3">\n' + "\n".join(carte_article(a) for a in articles) + "\n    </div>"


def rubriques_blog(articles):
    """Une section par catégorie sur la page Blog."""
    blocs = []
    for cle, nom in CATEGORIES.items():
        de_la_rubrique = [a for a in articles if a["categorie"] == cle]
        blocs.append(f'  <div class="dept-block" id="{cle}">\n    <div class="dept-head"><h2>{nom}</h2></div>\n'
                     + grille_articles(de_la_rubrique, f"Pas encore d'articles dans cette rubrique.") + "\n  </div>")
    return "\n".join(blocs)


def liens_spots(slugs, spots):
    """Pastilles de liens vers les spots cités par un article."""
    cites = [s for s in spots if s["slug"] in slugs]
    if not cites:
        return ""
    liens = "".join(f'<a class="chip" href="{url_spot(s)}">{e(s["nom"])}</a>' for s in cites)
    return f'<h2>Spots concernés</h2>\n      <div class="chips">{liens}</div>'


# --- Assemblage -------------------------------------------------------------

def page_complete(gabarit, morceaux, infos, contenu, chemin):
    """Assemble une page : gabarit + header + contenu + footer."""
    morceaux["sitemap"].append(chemin)
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
        "canonical": f"{SITE_URL}{BASE}/{chemin}",
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
    articles = charger_articles()
    video = (SITE / "assets" / "video" / "hero.webm").exists()
    credit_video = json.loads(lire(RACINE / "data" / "video-hero.json")) if video else None

    communs = {
        "base": BASE,
        "annee": date.today().year,
        "newsletter_action": e(NEWSLETTER_ACTION),
        "nombre_spots": len(spots),
        "liste_spots_gironde": liste_spots_html(gironde),
        "footer_spots": "\n".join(f'          <li><a href="{url_spot(s)}">{e(s["nom"])}</a></li>' for s in gironde),
        "derniers_articles": grille_articles(articles[:3]),
        "rubriques_blog": rubriques_blog(articles),
        "hero_classe": "hero--video" if video else "",
        # La vidéo n'est insérée que si le fichier site/assets/video/hero.webm existe
        "hero_video": (f'<video class="hero-video" autoplay muted loop playsinline preload="metadata">'
                       f'<source src="{BASE}/assets/video/hero.webm" type="video/webm"></video>') if video else "",
        "credits_medias": credits_medias_html(spots, credit_video),
        "liste_webcams": page_webcams_html(gironde),
    }
    morceaux = {
        "icones": lire(SITE / "partials" / "icons.html"),
        "header": lire(SITE / "partials" / "header.html"),
        "footer": lire(SITE / "partials" / "footer.html"),
        "communs": communs,
        "sitemap": [],
    }
    gabarit = lire(SITE / "templates" / "base.html")

    # 3. Pages éditoriales : site/pages/nom.html devient dist/nom/index.html
    nb_pages = 0
    for fichier in sorted((SITE / "pages").glob("*.html")):
        infos, contenu = lire_entete(lire(fichier))
        if fichier.stem == "index":
            destination, chemin = "index.html", ""
        elif fichier.stem == "404":
            destination, chemin = "404.html", "404.html"
        else:
            destination, chemin = f"{fichier.stem}/index.html", f"{fichier.stem}/"
        ecrire(destination, page_complete(gabarit, morceaux, infos, contenu, chemin))
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
            "photo": photo_html(spot),
            "webcam": webcam_fiche_html(spot),
            "bloc_prevision": bloc_prevision(spot, charger_prevision(spot["slug"])),
            "description": e(spot["description"]) if spot.get("description") else
                "La fiche détaillée de ce spot est en cours de rédaction : orientation, fond, marée qui fonctionne et niveau conseillé seront relevés sur le terrain.",
            "lien_carte": f"https://www.openstreetmap.org/?mlat={lat}&amp;mlon={lon}#map=14/{lat}/{lon}",
            "statut": (f"Recherche documentaire du {date_fr(spot['verifie_le'])}, pas encore vérifiée sur le terrain"
                       if spot.get("verifie_le") else "Fiche pas encore vérifiée"),
            "sources": sources_html(spot),
            "spots_proches": liste_spots_html(spots_proches(spot, spots)),
            "articles_spot": grille_articles(
                [a for a in articles if spot["slug"] in a["spots"]] or articles[:3]),
            "precedent": lien_voisin(au_nord, "nord"),
            "suivant": lien_voisin(au_sud, "sud"),
        })
        infos = {
            "titre": f"Surf à {spot['nom']} ({spot['commune']}) : prévisions et fiche spot | Swellcome",
            "description": f"Prévisions surf pour {spot['nom']}, à {spot['commune']} ({spot['departement']}) : houle, vent, marée et conseils selon votre niveau.",
            "nav": "spots",
        }
        chemin = f"{spot['departement_slug']}/{spot['slug']}/"
        ecrire(chemin + "index.html", page_complete(gabarit, morceaux, infos, contenu, chemin))

    # 5. Articles du blog
    modele_article = lire(SITE / "templates" / "article.html")
    for article in articles:
        autres = [a for a in articles if a["slug"] != article["slug"]][:3]
        contenu = remplacer(modele_article, {
            "article_titre": e(article["titre"]),
            "article_description": e(article["description"]),
            "article_categorie": CATEGORIES[article["categorie"]],
            "article_date": date_fr(article["date"]),
            "article_corps": article["corps"],
            "article_spots": liens_spots(article["spots"], spots),
            "article_autres": grille_articles(autres, "D'autres articles arrivent bientôt."),
        })
        infos = {"titre": f"{article['titre']} | Swellcome", "description": article["description"], "nav": "accompagnement"}
        chemin = f"blog/{article['slug']}/"
        ecrire(chemin + "index.html", page_complete(gabarit, morceaux, infos, contenu, chemin))

    ecrire("assets/data/apercu.json", apercu_carte(gironde))

    # 6. Plan du site pour les moteurs de recherche
    urls = "\n".join(f"  <url><loc>{SITE_URL}{BASE}/{c}</loc></url>"
                     for c in morceaux["sitemap"] if c != "404.html")
    ecrire("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "\n</urlset>\n")

    print(f"Site construit dans {SORTIE.relative_to(RACINE)}/ : "
          f"{nb_pages} pages, {len(spots)} fiches spots et {len(articles)} article(s).")


if __name__ == "__main__":
    construire()
