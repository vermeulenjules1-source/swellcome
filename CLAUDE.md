# Swellcome — instructions pour Claude Code

Swellcome est un site web de prévisions surf 100 % France, gratuit, qui adapte les conditions au niveau de chaque surfeur et envoie des alertes. Porteur du projet : Jules Vermeulen. Lis `docs/contexte.md` (vision, fonctionnalités, critères par niveau) et `docs/donnees-spots-licences.md` (sources de données, licences, architecture) avant toute tâche importante.

## Décisions prises (6 novembre 2026)

Ces décisions priment sur les documents de `docs/` en cas de contradiction.

**Uniquement des services gratuits.** Pas de publicité, d'affiliation ni d'abonnement sur le site tant qu'on utilise l'API gratuite d'Open-Meteo, réservée au non commercial. Un bouton de dons est autorisé. Toute brique payante doit être signalée à Jules avant d'être ajoutée.

**Prévisions : Open-Meteo.** Marine API (`marine-api.open-meteo.com/v1/marine`) pour la houle primaire et secondaire, la mer du vent, la période, la direction et la température de l'eau. Forecast API pour le vent (vitesse, rafales, direction), en privilégiant les modèles Météo-France (AROME, ARPEGE). Requêtes multi-coordonnées par lots. Quotas gratuits : 600 appels/min, 5 000/h, 10 000/jour. Une requête de plus de 10 variables ou de plus de deux semaines compte pour plusieurs appels.

**Marées : FES2022 + PyFES, calculées nous-mêmes.** Aucune donnée du Shom ni de maree.info. Un job précalcule les pleines et basses mers de chaque spot sur 30 jours (une fois par semaine suffit). Le coefficient est estimé à partir du marnage calculé à Brest et affiché comme indicatif. Il faut créer un compte AVISO pour télécharger FES2022 : demander à Jules, ne jamais committer les fichiers du modèle ni les identifiants.

**Mise à jour automatique : GitHub Actions.** Un workflow programmé 4 fois par jour, à une minute peu chargée (par exemple `17 3,9,15,21 * * *` en UTC, à ajuster après observation des horaires de sortie des modèles). Il récupère les données, écrit un JSON par spot dans `data/`, ne committe que si le contenu a changé (comparaison par hash), puis déclenche la reconstruction du site. Pas de tâches programmées Vercel (une seule par jour en gratuit).

**Hébergement : site statique** sur GitHub Pages ou Cloudflare Pages. Alertes email plus tard via l'offre gratuite de Resend (100/jour) ou Brevo (300/jour).

**Spots : base construite par Swellcome.** Jamais de scraping ni de copie de Surf-Forecast, Windguru, Windy, Surfline, Wannasurf ou Surf-Report : ni prévisions, ni listes de spots, ni textes, ni photos. Pas de widgets Windy ou Surf-Forecast. Chaque spot porte un champ `sources` et une date de vérification. Si des données OpenStreetMap sont fusionnées dans la base, elle doit être publiée sous ODbL avec la mention « © les contributeurs d'OpenStreetMap ».

## Premier objectif : prototype Gironde

Dix spots de Soulac au Porge, une page publique par spot (`/gironde/<slug-spot>`), avec houle, vent et marée sur 7 jours, puis le verdict par niveau (top, correct, à oublier) avec un sélecteur de niveau sans compte. Les fiches spots (orientation, fond, marée qui marche, niveau minimal) sont renseignées à la main par Jules. Prévoir des champs vides plutôt que d'inventer des valeurs.

## Stack

À confirmer avec Jules lors de la première session. Proposition par défaut : scripts de collecte et de marée en Python (PyFES l'impose) et générateur de site statique léger (Astro, ou HTML/CSS/JS simple). Jules code en HTML/CSS de base : privilégier un code lisible et commenté, expliquer chaque étape et éviter les dépendances inutiles.

## Arborescence visée

```
docs/            contexte et rapport de recherche
data/spots/      fiches spots (une par spot, JSON ou YAML)
data/forecast/   JSON générés par la collecte (un par spot)
data/tides/      marées précalculées
scripts/         collecte Open-Meteo, calcul des marées, verdicts
site/            code du site statique
.github/workflows/  tâches programmées
```

## Identité visuelle

Logo : `assets/logo.png` (icône carrée bleu marine avec une vague blanche, « Swellcome » en gras, sous-titre « SURF FORECAST » en capitales espacées). Couleurs relevées sur le logo : bleu marine `#12293C` et fond crème `#FAF7F2`. Le blanc est la couleur de la vague. Style sobre et lisible, sans dégradé. Une version vectorielle (SVG) et un favicon restent à produire à partir de ce fichier.

## Mentions obligatoires sur le site

Attribution Open-Meteo (CC BY 4.0) et modèles sous-jacents (Météo-France, ECMWF, NOAA, DWD) ; « Marées calculées à partir de FES2022 (CNES/AVISO), indicatives, ne remplacent pas l'annuaire du Shom » ; avertissement de sécurité sur chaque page (prévisions indicatives, vérifier les conditions sur place, baignades surveillées, drapeaux, baïnes). Plus tard, si on les utilise : Copernicus Marine (« Generated using E.U. Copernicus Marine Service Information ») et Candhis (Cerema et partenaires).

## Conventions

Interface, contenus et commentaires de code en français. Communication avec Jules concise et directe, formes au masculin. Pas de secrets dans le dépôt (utiliser les secrets GitHub Actions). Petits commits avec des messages clairs en français.
