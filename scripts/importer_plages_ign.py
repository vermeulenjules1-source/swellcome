"""
Crée les fiches des plages océanes d'un département à partir de la BD TOPO de l'IGN (Licence Ouverte).

La position vient des baignades surveillées, l'orientation du trait de côte voisin.
Aucun site de prévisions ni guide de spots n'est utilisé. Ce qui n'est pas connu reste vide :
les fiches sont à compléter avec des sources publiques ou des relevés de terrain.

Utilisation (depuis la racine du dépôt) :
    python3 scripts/importer_plages_ign.py            affiche ce qui serait créé
    python3 scripts/importer_plages_ign.py --ecrire   écrit les fiches dans data/spots/

Une fiche existante n'est jamais écrasée. Aucune bibliothèque à installer.
"""

import json
import math
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
FICHES = RACINE / "data" / "spots"
WFS = "https://data.geopf.fr/wfs/ows?"
GEO_API = "https://geo.api.gouv.fr/communes/"

# sud, ouest, nord, est (latitude, longitude)
ZONE = (43.33, -1.85, 44.56, -1.10)
DEPARTEMENTS = {
    "40": {"nom": "Landes", "slug": "landes"},
    "64": {"nom": "Pays basque", "slug": "pays-basque"},
}
TYPES_COTE = {None}         # le trait de côte n'a pas de type ; les autres valeurs sont des limites administratives
DISTANCE_MAX_COTE_M = 350   # au-delà, la baignade est sur un lac ou un plan d'eau
RAYON_ORIENTATION_M = 600   # longueur de côte prise en compte de chaque côté
SONDE_MER_M = 1500          # distance du point testé pour savoir de quel côté est la mer
LARGE_REFERENCE_DEG = 300   # le large est au nord-ouest : sert à trancher au fond des baies
ECART_MAX_COTE_DEG = 40     # écarte les digues et les ports, qui faussent la direction de la côte
RAYON_VOISINES_KM = 6       # plages comparées pour repérer une orientation aberrante
ECART_MAX_VOISINES_DEG = 35 # au-delà de cet écart avec ses voisines, une plage reprend leur orientation médiane

GENERIQUES = re.compile(r"^(centrale|sud|nord|centre|le centre|océan|l'océan|grande plage.*|la grande plage|.*grande plage)$", re.I)
POINTS_16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"]


def wfs(couche, filtre, nombre=5000, depart=0):
    parametres = {
        "SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature", "TYPENAMES": couche,
        "OUTPUTFORMAT": "application/json", "COUNT": nombre, "STARTINDEX": depart, "CQL_FILTER": filtre,
    }
    with urllib.request.urlopen(WFS + urllib.parse.urlencode(parametres), timeout=120) as reponse:
        return json.load(reponse)["features"]


def boite(sud, ouest, nord, est):
    return f"BBOX(geometrie,{sud},{ouest},{nord},{est},'urn:ogc:def:crs:EPSG::4326')"


def tout_lire(couche, filtre):
    objets, depart = [], 0
    while True:
        page = wfs(couche, filtre, 5000, depart)
        objets += page
        if len(page) < 5000:
            return objets
        depart += 5000


def vers_metres(lon, lat, lat0):
    """Projection locale simple : suffisante à l'échelle d'une plage."""
    return math.radians(lon) * 6371000 * math.cos(math.radians(lat0)), math.radians(lat) * 6371000


def centre(geometrie):
    """Centre approximatif d'un point ou d'un polygone."""
    points = geometrie["coordinates"]
    while isinstance(points[0][0], list):
        points = points[0]
    if isinstance(points[0], (int, float)):
        return points[1], points[0]
    return sum(p[1] for p in points) / len(points), sum(p[0] for p in points) / len(points)


def est_a_terre(lat, lon):
    marge = 0.00005
    return bool(wfs("BDTOPO_V3:commune", boite(lat - marge, lon - marge, lat + marge, lon + marge), 1))


def analyser_cote(lat, lon, segments):
    """Renvoie (distance à la côte en m, orientation vers le large en degrés), ou (None, None)."""
    x0, y0 = vers_metres(lon, lat, lat)
    proches, meilleur = [], None
    for (ax, ay), (bx, by) in segments:
        x1, y1 = vers_metres(ax, ay, lat)
        x2, y2 = vers_metres(bx, by, lat)
        dx, dy = x2 - x1, y2 - y1
        carre = dx * dx + dy * dy
        if carre == 0:
            continue
        t = max(0, min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / carre))
        px, py = x1 + t * dx, y1 + t * dy
        distance = math.hypot(px - x0, py - y0)
        if distance < RAYON_ORIENTATION_M:
            proches.append((dx, dy))
        if meilleur is None or distance < meilleur[0]:
            meilleur = (distance, px, py)
    if not proches or meilleur is None:
        return None, None

    # Direction moyenne de la côte : l'angle doublé rend le sens de parcours indifférent
    def direction(liste):
        somme_x = sum(dx * dx - dy * dy for dx, dy in liste)
        somme_y = sum(2 * dx * dy for dx, dy in liste)
        return math.atan2(somme_y, somme_x) / 2

    angle = direction(proches)
    def ecart(dx, dy):
        difference = (math.atan2(dy, dx) - angle) % math.pi
        return math.degrees(min(difference, math.pi - difference))
    alignes = [(dx, dy) for dx, dy in proches if ecart(dx, dy) <= ECART_MAX_COTE_DEG]
    if alignes:
        angle = direction(alignes)
    tangente_x, tangente_y = math.cos(angle), math.sin(angle)

    # Deux perpendiculaires possibles : celle du côté de la mer quitte la terre
    distance, px, py = meilleur
    candidates = [(-tangente_y, tangente_x), (tangente_y, -tangente_x)]
    en_mer = []
    for nx, ny in candidates:
        sx, sy = px + nx * SONDE_MER_M, py + ny * SONDE_MER_M
        sonde_lat = math.degrees(sy / 6371000)
        sonde_lon = math.degrees(sx / (6371000 * math.cos(math.radians(lat))))
        time.sleep(0.05)
        if not est_a_terre(sonde_lat, sonde_lon):
            en_mer.append((nx, ny))
    # Au fond d'une baie, les deux côtés peuvent toucher la terre : on prend le plus tourné vers le large
    choix = en_mer if len(en_mer) == 1 else candidates
    def vers_large(n):
        return abs(((math.degrees(math.atan2(n[0], n[1])) - LARGE_REFERENCE_DEG + 180) % 360) - 180)
    nx, ny = min(choix, key=vers_large)
    return distance, round(math.degrees(math.atan2(nx, ny)) % 360)


def nom_court(toponyme):
    """« Plage de la Gravière (Océan) » devient « La Gravière » ; None si le nom est générique."""
    nom = re.sub(r"\s*\(.*?\)", "", toponyme).strip()
    nom = re.sub(r"^Plage Naturiste\s+", "Plage ", nom, flags=re.I)
    for debut, remplacement in (("Plage des ", "Les "), ("Plage de la ", "La "), ("Plage du ", "Le "),
                                ("Plage de l'", "L'"), ("Plage de ", ""), ("Plage d'", ""), ("Plage ", "")):
        if nom.startswith(debut):
            nom = remplacement + nom[len(debut):]
            break
    return None if GENERIQUES.match(nom) else nom[0].upper() + nom[1:]


def en_slug(texte):
    texte = unicodedata.normalize("NFD", texte).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", texte).strip("-")


def nom_commune(insee, cache={}):
    if insee not in cache:
        with urllib.request.urlopen(GEO_API + insee + "?fields=nom", timeout=30) as reponse:
            cache[insee] = json.load(reponse)["nom"]
    return cache[insee]


def tournee(degres):
    return POINTS_16[round(degres / 22.5) % 16]


def phrase_orientation(degres):
    noms = {"N": "le nord", "NNE": "le nord-nord-est", "NE": "le nord-est", "ENE": "l'est-nord-est", "E": "l'est",
            "ESE": "l'est-sud-est", "SE": "le sud-est", "SSE": "le sud-sud-est", "S": "le sud", "SSO": "le sud-sud-ouest",
            "SO": "le sud-ouest", "OSO": "l'ouest-sud-ouest", "O": "l'ouest", "ONO": "l'ouest-nord-ouest",
            "NO": "le nord-ouest", "NNO": "le nord-nord-ouest"}
    return noms[tournee(degres)]


def main():
    ecrire = "--ecrire" in sys.argv
    sud, ouest, nord, est = ZONE
    cote = tout_lire("BDTOPO_V3:limite_terre_mer", boite(sud, ouest, nord, est))
    print("Types de limite :", Counter(f["properties"]["type_de_limite"] for f in cote))

    segments = []
    for objet in cote:
        if objet["properties"]["type_de_limite"] not in TYPES_COTE:
            continue
        points = objet["geometry"]["coordinates"]
        segments += list(zip(points, points[1:]))
    print("Segments de côte :", len(segments))

    baignades = tout_lire("BDTOPO_V3:zone_d_activite_ou_d_interet", f"nature='Baignade surveillée' AND {boite(sud, ouest, nord, est)}")
    plages, ecartees = [], []
    for objet in baignades:
        p = objet["properties"]
        insee = (p.get("insee_commune") or "").split("/")[0]
        if insee[:2] not in DEPARTEMENTS or not p.get("toponyme"):
            continue
        if re.search(r"\b[Ll]ac\b", p["toponyme"]):  # le lac d'Hossegor a lui aussi un trait de côte
            continue
        lat, lon = centre(objet["geometry"])
        distance, orientation = analyser_cote(lat, lon, segments)
        if distance is None or distance > DISTANCE_MAX_COTE_M or orientation is None:
            ecartees.append((p["toponyme"], distance and round(distance)))
            continue
        commune = nom_commune(insee)
        court = nom_court(p["toponyme"])
        sans_parentheses = re.sub(r"\s*\(.*?\)", "", p["toponyme"]).strip().capitalize()
        nom = court or f"{commune} – {sans_parentheses}"
        plages.append({"nom": nom, "toponyme": p["toponyme"], "commune": commune, "dep": insee[:2],
                       "lat": round(lat, 6), "lon": round(lon, 6), "orientation": orientation, "distance": round(distance)})

    # Près d'une digue ou d'un port, le calcul local se trompe : on reprend la médiane des plages voisines
    originales = {id(p): p["orientation"] for p in plages}
    for plage in plages:
        relatif = lambda d: ((d - originales[id(plage)] + 180) % 360) - 180
        voisines = sorted(relatif(originales[id(v)]) for v in plages
                          if v is not plage and math.hypot((v["lat"] - plage["lat"]) * 111, (v["lon"] - plage["lon"]) * 80) <= RAYON_VOISINES_KM)
        if voisines and abs(voisines[len(voisines) // 2]) > ECART_MAX_VOISINES_DEG:
            plage["orientation"] = round(originales[id(plage)] + voisines[len(voisines) // 2]) % 360
            print(f"Orientation corrigée par les voisines : {plage['toponyme']} ({plage['commune']}), {originales[id(plage)]}° devient {plage['orientation']}°")

    # Numérotation du nord au sud, département par département
    plages.sort(key=lambda x: -x["lat"])
    rangs = Counter()
    deja = {f.stem for f in FICHES.glob("*.json")}
    noms_vus = Counter(p["nom"] for p in plages)
    crees = 0
    for plage in plages:
        rangs[plage["dep"]] += 1
        dep = DEPARTEMENTS[plage["dep"]]
        nom = plage["nom"] if noms_vus[plage["nom"]] == 1 else f"{plage['commune']} – {plage['nom']}"
        slug = en_slug(nom)
        print(f"{plage['dep']} {slug:40} {plage['commune']:26} {plage['orientation']:3d}° {tournee(plage['orientation']):4} à {plage['distance']:3d} m de la côte  ({plage['toponyme']})")
        if slug in deja or not ecrire:
            continue
        fiche = {
            "slug": slug,
            "nom": nom,
            "noms_alternatifs": [plage["toponyme"]] if plage["toponyme"] != nom else [],
            "commune": plage["commune"],
            "departement": dep["nom"],
            "departement_slug": dep["slug"],
            "region": "Nouvelle-Aquitaine",
            "ordre_nord_sud": rangs[plage["dep"]],
            "coordonnees": {
                "lat": plage["lat"], "lon": plage["lon"], "precision": "plage",
                "note": "Zone de baignade surveillée selon la BD TOPO de l'IGN. Ce n'est pas la position exacte du pic.",
            },
            "orientation_deg": plage["orientation"],
            "orientation_16": tournee(plage["orientation"]),
            "fond": None,
            "type_vague": None,
            "maree_favorable": None,
            "fenetre_houle": None,
            "vent_ideal": None,
            "taille_ideale": None,
            "niveau_minimal": None,
            "dangers": [],
            "surveillance": "Baignade surveillée en saison selon la BD TOPO de l'IGN. Dates et horaires à vérifier auprès de la commune. Surf interdit dans la zone de baignade et ses abords.",
            "acces_parking": None,
            "description": f"Plage de {plage['commune']}, tournée vers {phrase_orientation(plage['orientation'])}. Fiche à compléter : le fond, le type de vague et les dangers restent à vérifier sur place.",
            "sources": [{
                "titre": "IGN, Géoplateforme : BD TOPO (limite terre-mer, baignades surveillées), Licence Ouverte",
                "url": "https://geoservices.ign.fr/bdtopo",
                "porte_sur": "position, orientation",
            }],
            "verifie_le": date.today().isoformat(),
            "confiance": "faible",
            "mode_verification": "documentaire",
            "webcams": [],
        }
        (FICHES / f"{slug}.json").write_text(json.dumps(fiche, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        crees += 1

    print(f"\n{len(plages)} plages retenues, {crees} fiches écrites.")
    print("Écartées (lac ou loin de la côte) :", ecartees)


if __name__ == "__main__":
    main()
