"""
Archive une partie de chaque prévision, pour la comparer plus tard à ce qui a été observé.

À chaque collecte, garde pour chaque spot les valeurs prévues à 6, 12, 24, 48 et 72 h,
dans data/archive/previsions-AAAA-MM.jsonl (une ligne par spot et par échéance).
Sans ces paires prévision/observation, aucun calage n'est possible.
Les sessions vues sur place se notent dans data/observations/sessions.csv.

Utilisation (depuis la racine du dépôt) : python3 scripts/enregistrer_previsions.py
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

RACINE = Path(__file__).resolve().parent.parent
PREVISIONS = RACINE / "data" / "forecast"
ARCHIVE = RACINE / "data" / "archive"
ECHEANCES_H = (6, 12, 24, 48, 72)
CHAMPS = {"houle": "houle", "houle_min": "houle_min", "houle_max": "houle_max", "periode": "periode",
          "direction": "direction", "vent": "vent", "rafales": "rafales", "vent_dir": "vent_dir"}


def main():
    maintenant = datetime.now(ZoneInfo("Europe/Paris")).replace(minute=0, second=0, microsecond=0, tzinfo=None)
    run = maintenant.strftime("%Y-%m-%dT%H")
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    chemin = ARCHIVE / f"previsions-{maintenant:%Y-%m}.jsonl"
    if chemin.exists() and f'"run":"{run}"' in chemin.read_text(encoding="utf-8"):
        print("Déjà archivé pour cette heure.")
        return

    lignes = []
    for fichier in sorted(PREVISIONS.glob("*.json")):
        heures = json.loads(fichier.read_text(encoding="utf-8"))["heures"]
        rangs = {t: i for i, t in enumerate(heures["temps"])}
        for echeance in ECHEANCES_H:
            cible = (maintenant + timedelta(hours=echeance)).strftime("%Y-%m-%dT%H:00")
            if cible not in rangs:
                continue
            valeurs = {court: heures.get(cle, [None] * len(heures["temps"]))[rangs[cible]] for cle, court in CHAMPS.items()}
            lignes.append(json.dumps({"run": run, "slug": fichier.stem, "t": cible, "e": echeance, **valeurs},
                                     ensure_ascii=False, separators=(",", ":")))
    with chemin.open("a", encoding="utf-8") as sortie:
        sortie.write("\n".join(lignes) + "\n")
    print(f"{len(lignes)} lignes archivées pour {run}.")


if __name__ == "__main__":
    main()
