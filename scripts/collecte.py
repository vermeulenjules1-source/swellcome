"""
Récupère les prévisions Open-Meteo et écrit un fichier par spot dans data/forecast/.

Sources (CC BY 4.0) :
  - Marine API : houle, période, direction, mer du vent, température de l'eau.
    La houle principale est la médiane de plusieurs modèles (MODELES_HOULE).
  - Forecast API : vent et rafales, modèles Météo-France (AROME, ARPEGE),
    complétés par ECMWF au-delà de leur échéance (environ 4 jours).

Utilisation (depuis la racine du dépôt) :
    python3 scripts/collecte.py

Un fichier n'est réécrit que si les prévisions ont changé, pour éviter les commits inutiles.
Aucune bibliothèque à installer : uniquement Python 3.
"""

import json
import statistics
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
FICHES = RACINE / "data" / "spots"
SORTIE = RACINE / "data" / "forecast"

URL_MARINE = "https://marine-api.open-meteo.com/v1/marine"
URL_METEO = "https://api.open-meteo.com/v1/forecast"
JOURS = 7
MODELES_VENT = ["meteofrance_seamless", "ecmwf_ifs025"]  # par ordre de préférence
# Modèles comparés pour la houle. ECMWF ne donne pas la houle séparée de la mer du vent : il n'y figure pas.
MODELES_HOULE = ["meteofrance_wave", "ewam", "gwam", "ncep_gfswave016"]
TAILLE_LOT = 50   # nombre de spots par requête

# Noms courts utilisés dans les JSON et dans le graphique
VARIABLES_MARINE = {
    "wave_height": "hauteur",
    "swell_wave_height": "houle",
    "swell_wave_period": "periode",
    "swell_wave_direction": "direction",
    "secondary_swell_wave_height": "houle2",
    "secondary_swell_wave_period": "periode2",
    "secondary_swell_wave_direction": "direction2",
    "wind_wave_height": "mer_vent",
    "sea_surface_temperature": "eau",
    # Marée provisoire, en mètres par rapport au niveau moyen, en attendant FES2022.
    # Open-Meteo précise que cette donnée ne convient pas à la navigation côtière.
    "sea_level_height_msl": "maree",
}
VARIABLES_VENT = {
    "wind_speed_10m": "vent",
    "wind_gusts_10m": "rafales",
    "wind_direction_10m": "vent_dir",
}


def appeler(url, parametres):
    """Interroge Open-Meteo. Renvoie toujours une liste (une entrée par spot)."""
    adresse = url + "?" + urllib.parse.urlencode(parametres)
    with urllib.request.urlopen(adresse, timeout=90) as reponse:
        donnees = json.load(reponse)
    return donnees if isinstance(donnees, list) else [donnees]


def collecter_lot(spots):
    coordonnees = {
        "latitude": ",".join(str(s["coordonnees"]["lat"]) for s in spots),
        "longitude": ",".join(str(s["coordonnees"]["lon"]) for s in spots),
        "forecast_days": JOURS,
        "timezone": "Europe/Paris",
    }
    marine = appeler(URL_MARINE, {**coordonnees, "hourly": ",".join(VARIABLES_MARINE)})
    comparaison = appeler(URL_MARINE, {
        **coordonnees,
        "hourly": "swell_wave_height,swell_wave_peak_period,swell_wave_direction",
        "models": ",".join(MODELES_HOULE),
    })
    meteo = appeler(URL_METEO, {
        **coordonnees,
        "hourly": ",".join(VARIABLES_VENT),
        "daily": "sunrise,sunset",
        "models": ",".join(MODELES_VENT),
        "cell_selection": "sea",  # point mer le plus proche, sans mélange de cases terre et mer
    })

    for spot, m, c, v in zip(spots, marine, comparaison, meteo):
        heures = {"temps": m["hourly"]["time"]}
        for api, nom in VARIABLES_MARINE.items():
            heures[nom] = m["hourly"][api]
        combiner_modeles(heures, c["hourly"])
        # Le vent et la mer sont alignés sur les mêmes heures
        index_vent = {t: i for i, t in enumerate(v["hourly"]["time"])}
        for api, nom in VARIABLES_VENT.items():
            heures[nom] = [
                valeur_vent(v["hourly"], api, index_vent[t]) if t in index_vent else None
                for t in heures["temps"]
            ]
        # Écart entre modèles de vent, pour l'indice de confiance
        ecarts_vent = [ecart_vent(v["hourly"], index_vent[t]) if t in index_vent else (None, None) for t in heures["temps"]]
        heures["vent_min"] = [mini for mini, _ in ecarts_vent]
        heures["vent_max"] = [maxi for _, maxi in ecarts_vent]
        ecrire_si_change(spot, {
            "slug": spot["slug"],
            "point_modele": {"lat": m["latitude"], "lon": m["longitude"]},
            "heures": heures,
            "soleil": {
                "jours": v["daily"]["time"],
                "lever": serie_soleil(v["daily"], "sunrise"),
                "coucher": serie_soleil(v["daily"], "sunset"),
            },
        })


def mediane_direction(directions):
    """Médiane d'angles : 350° et 10° doivent donner 0°, pas 180°."""
    reference = directions[0]
    ecarts = [((d - reference + 180) % 360) - 180 for d in directions]
    return round((reference + statistics.median(ecarts)) % 360)


def combiner_modeles(heures, modeles):
    """Remplace la houle principale par la médiane des modèles, et garde leur écart.

    La période retenue est la période de pic, celle de la houle la plus énergique : c'est elle qui fait
    la force des vagues, alors que la moyenne baisse dès que la mer est mélangée. À défaut, on garde la moyenne.
    Une hauteur nulle signale une maille du modèle posée sur la terre : elle est ignorée.
    """
    rangs = {t: i for i, t in enumerate(modeles["time"])}
    heures["periode_moyenne"] = heures["periode"]
    for nom in ("houle_min", "houle_max", "periode_min", "periode_max", "nb_modeles"):
        heures[nom] = [None] * len(heures["temps"])

    for i, t in enumerate(heures["temps"]):
        rang = rangs.get(t)
        if rang is None:
            continue
        hauteurs, directions, pics = [], [], []
        for modele in MODELES_HOULE:
            hauteur = modeles[f"swell_wave_height_{modele}"][rang]
            direction = modeles[f"swell_wave_direction_{modele}"][rang]
            pic = modeles[f"swell_wave_peak_period_{modele}"][rang]
            if hauteur:
                hauteurs.append(hauteur)
                if direction is not None:
                    directions.append(direction)
            if pic is not None:
                pics.append(pic)
        if hauteurs:
            heures["houle"][i] = round(statistics.median(hauteurs), 2)
            heures["houle_min"][i] = min(hauteurs)
            heures["houle_max"][i] = max(hauteurs)
            heures["nb_modeles"][i] = len(hauteurs)
        if directions:
            heures["direction"][i] = mediane_direction(directions)
        if pics:
            heures["periode"][i] = round(statistics.median(pics), 2)
            heures["periode_min"][i] = min(pics)
            heures["periode_max"][i] = max(pics)


def valeur_vent(horaire, variable, rang):
    """Première valeur disponible, en suivant l'ordre de préférence des modèles."""
    for modele in MODELES_VENT:
        valeur = horaire[f"{variable}_{modele}"][rang]
        if valeur is not None:
            return valeur
    return None


def ecart_vent(horaire, rang):
    """Plus petite et plus grande vitesse annoncées par les modèles de vent à cette heure."""
    valeurs = [horaire[f"wind_speed_10m_{modele}"][rang] for modele in MODELES_VENT]
    valeurs = [x for x in valeurs if x is not None]
    return (min(valeurs), max(valeurs)) if valeurs else (None, None)


def serie_soleil(quotidien, variable):
    """Avec plusieurs modèles, Open-Meteo peut suffixer le nom de la variable."""
    return quotidien.get(variable) or quotidien[f"{variable}_{MODELES_VENT[0]}"]


def ecrire_si_change(spot, donnees):
    chemin = SORTIE / f"{spot['slug']}.json"
    if chemin.exists():
        ancien = json.loads(chemin.read_text(encoding="utf-8"))
        ancien.pop("mis_a_jour", None)
        if ancien == donnees:
            return
    donnees = {"mis_a_jour": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), **donnees}
    chemin.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Mis à jour :", spot["slug"])


def main():
    SORTIE.mkdir(parents=True, exist_ok=True)
    spots = [json.loads(f.read_text(encoding="utf-8")) for f in sorted(FICHES.glob("*.json"))]
    for debut in range(0, len(spots), TAILLE_LOT):
        collecter_lot(spots[debut:debut + TAILLE_LOT])
    print(f"Collecte terminée pour {len(spots)} spots.")


if __name__ == "__main__":
    main()
