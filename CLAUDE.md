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

Dix spots de Soulac au Porge, une page publique par spot (`/gironde/<slug-spot>`), avec houle, vent et marée sur 7 jours, puis le verdict par niveau (top, correct, à oublier) avec un sélecteur de niveau sans compte. Les fiches spots (orientation, fond, marée qui marche, niveau minimal) sont renseignées à la main par Jules. Prévoir des champs vides plutôt que d'inventer des valeurs. Depuis le 9 novembre 2026, les dix fiches sont préremplies par recherche documentaire à la demande de Jules (`mode_verification: documentaire`) : positions et orientations calculées depuis la BD TOPO de l'IGN, le reste avec ses `sources`. Elles restent à vérifier sur le terrain. Les sites de prévisions et guides de spots ne servent jamais de source.

## Stack

Validée avec Jules le 6 novembre 2026 : HTML/CSS/JS simple, assemblé par `scripts/build.py` (Python, bibliothèque standard uniquement). Le script colle header et footer sur chaque page de `site/pages/`, génère une page par fiche de `data/spots/` et écrit le tout dans `dist/` (non commité). Polices Manrope et Inter hébergées dans `site/assets/fonts/`, aucun appel à Google Fonts. Scripts de collecte et de marée en Python (PyFES l'impose). Jules code en HTML/CSS de base : privilégier un code lisible et commenté, expliquer chaque étape et éviter les dépendances inutiles.

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

La référence est `docs/charte-graphique.md` (version 1.0, novembre 2026) : elle prime sur les couleurs relevées auparavant sur le logo. En résumé :

- Signature : « Know before you go. », descriptif « Surf Forecast ».
- Couleurs : Deep Ocean `#09283B` (principale), Sea Mist `#DCEBE8` (secondaire), Soft Sand `#F4F1E9` (fond alternatif), Pure White `#FFFFFF` (dominante), Ocean Teal `#77B9B1` et Warm Sun `#E6B96C` (accents rares).
- Typographies : Manrope (titres, chiffres clés, SemiBold/Bold) et Inter (textes, Regular/Medium), hébergées sur le site.
- Icônes fines style Lucide, cartes blanches arrondies, ombres très légères, pas de dégradé marqué ni d'effet 3D.
- Jamais d'information portée par la couleur seule : toujours un libellé ou une valeur. Jamais de valeur d'exemple présentée comme une prévision réelle.

Logo : `assets/logo.png` (icône carrée bleu marine avec une vague blanche, « Swellcome » en gras, sous-titre « SURF FORECAST » en capitales espacées). Une version vectorielle (SVG) et un favicon restent à produire à partir de ce fichier.

## Mentions obligatoires sur le site

Attribution Open-Meteo (CC BY 4.0) et modèles sous-jacents (Météo-France, ECMWF, NOAA, DWD) ; « Marées calculées à partir de FES2022 (CNES/AVISO), indicatives, ne remplacent pas l'annuaire du Shom » ; avertissement de sécurité sur chaque page (prévisions indicatives, vérifier les conditions sur place, drapeaux, baïnes). Ne jamais conseiller de surfer en zone surveillée : le surf y est interdit et met les baigneurs en danger. Plus tard, si on les utilise : Copernicus Marine (« Generated using E.U. Copernicus Marine Service Information ») et Candhis (Cerema et partenaires).

## Conventions

Interface, contenus et commentaires de code en français. Communication avec Jules concise et directe, formes au masculin. Pas de secrets dans le dépôt (utiliser les secrets GitHub Actions). Petits commits avec des messages clairs en français. Commiter et publier seulement quand Jules le demande, à chaque fois, puis vérifier le site publié.

## État du projet (9 novembre 2026)

En ligne : https://vermeulenjules1-source.github.io/swellcome/ (dépôt `vermeulenjules1-source/swellcome`, GitHub Pages, branche `main`). Chaque push publie le site. Aperçu local : configuration `swellcome` de `.claude/launch.json`, port 8000.

**Ce qui existe**
- Accueil : vidéo, carte 3D, 10 cartes photo qui mènent aux pages spots (`carte.js`, `data` généré par `build.py` dans `assets/data/apercu.json`).
- Fiches spots : photo, onglets Prévisions, Le spot, Conseils, curseur horaire (`forecast.js`, `main.js`, `templates/spot.html`).
- Pages Webcams (liens sortants uniquement), Accompagnement, guide avec mini-jeu (`jeu-forecast.js`), blog, pages légales.
- Calcul commun dans `site/assets/js/verdict.js` : à modifier là, jamais en double.
- Collecte : `scripts/collecte.py` et `.github/workflows/deploy.yml`, 4 fois par jour.
- Carte : MapLibre et données IGN, style généré par `scripts/style_carte.py`.

**Retours de Jules à respecter**
- La hauteur affichée est une taille estimée au bord : houle, période et direction par rapport à la plage. Jamais la hauteur totale du large. Une houle courte ou de sud-ouest donne presque rien en Gironde. Depuis le 10 novembre 2026, `houle`, `periode` (de pic) et `direction` de `data/forecast/` sont les médianes de `MODELES_HOULE` dans `collecte.py` (`periode_moyenne`, `houle_min`, `houle_max`, `nb_modeles` conservés). Ne jamais comparer automatiquement aux sites concurrents. Infoclimat : API avec clé uniquement, pas de lecture des pages ; station `000DZ` en CC BY utile pour Lacanau.
- Les spots de Gironde saturent vers 3 m (`saturation_m`) : à oublier pour tous les niveaux.
- Sur l'accueil, pas de « À oublier » : la raison (Flat, Vent, Trop gros, Trop petit, Houle courte, Saturé).
- Les trois verdicts sont « Top », « Correct » et « À oublier », avec shaka, pouce levé et pouce baissé (`VERDICTS` dans `verdict.js`).
- Ton : voir le Tone of Voice de Jules (10 novembre 2026, PDF sur son bureau). Tutoiement, français de plage, une seule vanne par écran, jamais sur la sécurité ni le niveau. La banque de phrases est dans `verdict.js`. Signature : « Ne rate plus aucune session. ». Exception maintenue : ne jamais écrire « privilégie les zones surveillées », le surf y est interdit.
- Tailles de texte : utiliser l'échelle `--t-*` de `style.css`, ne pas en créer d'autres. Directions et marées écrites en clair, jamais « O » seul ni hauteur négative.
- Le bouton et le formulaire newsletter ne s'affichent que si `NEWSLETTER_ACTION` est rempli dans `build.py`.
- Chaque spot a sa propre page ; l'accueil ne fait qu'y mener.
- Style : pas d'aspect fade ni « fait par une IA ». Fonds sombres, verdict lisible sans être géant (demande de Jules du 9 novembre 2026), photos, textes courts et directs. Éviter les petits titres en capitales, les blocs à trois icônes, les tuiles beiges, les slogans en antithèse.
- Pas d'image ni de flux Viewsurf sans autorisation écrite : ses mentions légales l'interdisent. Ne pas se présenter comme un navigateur pour récupérer des fichiers.
- Vidéo sous CC BY-SA : le crédit doit rester sur la page À propos, reliée depuis le pied de page.

**Landes et Pays basque (10 novembre 2026)** : 44 fiches, position et orientation depuis la BD TOPO (`scripts/importer_plages_ign.py`, à ne plus relancer tel quel : les doublons ont été triés à la main), une plage par plage. Photos Wikimedia Commons sous licence libre. Faits issus de sources publiques seulement (guides touristiques, Shom, BRGM, préfecture) ; le reste affiche « À confirmer ». Surf-Report et les autres sites de spots restent exclus, même pour une simple liste. La carte de l'accueil montre tous les spots, avec des étiquettes pour les meilleurs et des points pour les autres ; la grille reste sur la Gironde.

**À faire ou à vérifier**
- Attendre de Jules : email de contact et choix d'adresse pour les mentions légales (passages `.to-fill`), compte Brevo (`NEWSLETTER_ACTION` dans `build.py`), compte AVISO pour les marées.
- Collecte automatique : le `schedule` de GitHub ne se déclenchait pas, il est retiré depuis le 9 novembre 2026. Une tâche cron-job.org (compte de Jules) appelle `workflow_dispatch` de `deploy.yml` à 3 h 17, 9 h 17, 15 h 17 et 21 h 17 UTC, avec un jeton GitHub limité à Actions sur ce dépôt. Le jeton expire : le renouveler à temps. Vérifier le premier lancement automatique. `alertes.yml`, non publié, utilise encore `schedule` et devra passer par le même déclencheur.
- Caler les coefficients de `EFFET_PERIODE` avec des retours de terrain. Premier test : Le Porge, mercredi 11 novembre au matin, le site donne 1,7 m au bord pour 1,9 m au large à 10 s, un autre site annonçait 2,3 m.
- Marées : solution provisoire demandée par Jules le 9 novembre 2026, en attendant la réponse d'AVISO (demande envoyée). Niveau de la mer d'Open-Meteo (`sea_level_height_msl`, champ `maree` de `data/forecast/`), pleines et basses mers repérées dans `verdict.js`, pas de coefficient. À remplacer par FES2022 et un job GitHub hebdomadaire (choix de Jules), puis remettre les mentions FES2022 sur le site. Le verdict ne tient pas compte de la marée : 9 fiches sur 10 n'ont pas de `maree_favorable`.
- Tester sur un vrai iPhone : la vidéo n'existe qu'en WebM, avec retour aux vagues animées si elle n'est pas lue.
- Fiches spots à confirmer sur le terrain, saturation à affiner spot par spot.
