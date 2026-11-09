# Swellcome

Prévisions surf pour toute la France, adaptées au niveau de chaque surfeur. Know before you go.

Projet en construction : prototype sur dix spots de Gironde. Le contexte complet est dans `docs/contexte.md`, les choix de données et de licences dans `docs/donnees-spots-licences.md` et l'identité visuelle dans `docs/charte-graphique.md`.

## Voir le site en local

Il suffit de Python 3, rien à installer :

```bash
python3 scripts/build.py
python3 -m http.server 8000 -d dist
```

Puis ouvrir http://localhost:8000.

## Organisation

```
site/pages/       une page = un fichier HTML (accueil, spots, guide, pages légales…)
site/blog/        un article = un fichier HTML (modèle : _modele.html)
site/partials/    header, footer + newsletter, icônes : communs à toutes les pages
site/templates/   gabarit général (base.html) et gabarit d'une fiche spot (spot.html)
site/assets/      CSS, JavaScript, polices, images
data/spots/       une fiche JSON par spot
scripts/build.py  assemble le tout dans dist/ (dossier généré, non commité)
```

- **Modifier le menu ou le footer** : `site/partials/header.html` ou `footer.html`, puis relancer `build.py`.
- **Ajouter une page** : créer `site/pages/ma-page.html` avec l'en-tête `titre` / `description` ; elle sera servie à `/ma-page/`.
- **Compléter un spot** : remplir les champs de `data/spots/<slug>.json` (laisser `null` ce qui n'est pas vérifié), indiquer `sources` et `verifie_le`.
- **Écrire un article** : copier `site/blog/_modele.html` sous un nouveau nom et remplir l'en-tête ; indiquer `spots` pour l'afficher sur les fiches concernées.
- **Mettre une vraie vidéo dans le bandeau** : déposer le fichier dans `site/assets/video/hero.mp4` (court, compressé, sans son) et relancer `build.py`.
- **Brancher la newsletter** : coller l'adresse du formulaire (Brevo par exemple) dans `NEWSLETTER_ACTION` en haut de `scripts/build.py`.

## Données

Données de prévision : [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Marées calculées à partir de FES2022 (CNES/AVISO), à titre indicatif.
