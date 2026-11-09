"""
Génère le style de la carte de l'accueil, aux couleurs de la charte graphique.

Part du style « Plan IGN » publié par la Géoplateforme (Licence Ouverte), garde
les couches utiles et les recolore. Le résultat est commité dans site/assets/data/.
À relancer seulement pour changer l'apparence de la carte :

    python3 scripts/style_carte.py

Aucune bibliothèque à installer : uniquement Python 3.
"""

import json
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "site" / "assets" / "data" / "style-carte.json"
SOURCE = "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json"

TERRE = "#F4F1E9"       # Soft Sand
MER = "#0C3246"         # proche de Deep Ocean, un peu plus clair que le texte
ESTRAN = "#2F6F73"
FORET = "#D8E3D5"
FORET_OUVERTE = "#E3EADC"
LANDE = "#ECE8D5"
SABLE = "#E7DBBE"
SABLE_HUMIDE = "#D8CBA9"
BATI = "#E5DFCF"
ROUTE_BORD = "#D5CCB8"
ROUTE = "#FFFFFF"
TEXTE = "#09283B"

COULEURS_FOND = {
    "bckgrd": TERRE,
    "ocs - vegetation - zone boiséee, foret fermee, peupleraie": FORET,
    "ocs - vegetation - forêt ouverte": FORET_OUVERTE,
    "ocs - vegetation - lande ligneuse": LANDE,
    "ocs - Zone sable sec": SABLE,
    "ocs - Zone sable humide": SABLE_HUMIDE,
    "zone batie": BATI,
    "hydro surfacique - Estran": ESTRAN,
    "hydro surfacique": MER,
}

ROUTES_GARDEES = ("route locale", "route regionale", "route principale", "autoroute", "bretelle")


def couche_route(couche):
    """Une route garde ses largeurs IGN, mais perd ses couleurs."""
    nom = couche["id"]
    if "en construction" in nom or "axe" in nom or not any(r in nom for r in ROUTES_GARDEES):
        return None
    couche["paint"]["line-color"] = ROUTE_BORD if "exterieur" in nom or "extérieur" in nom else ROUTE
    return couche


def couche_texte(couche, couleur, halo):
    layout = couche.get("layout", {})
    if "icon-image" in layout:
        return None
    couche["paint"] = {"text-color": couleur, "text-halo-color": halo, "text-halo-width": 1.4}
    return couche


def adapter(couche):
    """Renvoie la couche recolorée, ou None pour l'écarter."""
    source = couche.get("source-layer")
    nom = couche["id"]

    if couche["type"] == "fill" and nom in COULEURS_FOND:
        couche["paint"] = {"fill-color": COULEURS_FOND[nom]}
        return couche
    if source == "routier_route" and couche["type"] == "line":
        return couche_route(couche)
    if source == "hydro_reseau" and nom == "réseau hydro - cours d'eau":
        couche["paint"]["line-color"] = MER
        return couche
    if source == "toponyme_localite_ponc" and ("importance" in nom or " commune" in nom) and "non commune" not in nom:
        return couche_texte(couche, TEXTE, "rgba(244, 241, 233, 0.9)")
    if source == "toponyme_hydro_ponc" and couche["type"] == "symbol":
        return couche_texte(couche, "#DCEBE8", "rgba(12, 50, 70, 0.6)")
    return None


def main():
    with urllib.request.urlopen(SOURCE, timeout=60) as reponse:
        style = json.load(reponse)

    style["name"] = "Swellcome, d'après Plan IGN"
    style.pop("sprite", None)
    # Une seule adresse de tuiles : évite un appel de plus au chargement
    style["sources"]["plan_ign"].pop("url", None)
    style["sources"]["plan_ign"]["minzoom"] = 0
    style["sources"]["plan_ign"]["maxzoom"] = 16
    couches = [adapter(c) for c in style["layers"]]
    style["layers"] = [{"id": "fond", "type": "background", "paint": {"background-color": TERRE}}] + \
        [c for c in couches if c]

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps(style, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(style['layers'])} couches écrites dans {SORTIE.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
