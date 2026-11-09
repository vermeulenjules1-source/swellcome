# Swellcome — Contexte du projet

6 novembre 2026 · Jules Vermeulen

## Le projet

Swellcome est un site de prévisions surf 100 % France, gratuit, qui adapte les conditions au niveau de chaque surfeur et l'alerte quand sa session arrive. La promesse tient en une phrase : ne plus rater aucune session.

Le site a deux étages. Le premier est un forecast classique (houle, période, vent, marée) pour tous les spots de France, accessible sans compte. Le second est un compte personnel : niveau, home spot, critères de session idéale et alertes. Un blog d'infos locales complète l'ensemble et nourrit le référencement.

La cible prioritaire est le surfeur débutant à intermédiaire qui surfe un ou deux spots réguliers et ne sait pas toujours lire un forecast. Exemple type : Titouan, intermédiaire, home spot Lacanau, qui veut être prévenu dès qu'une journée correspond à son niveau.

Pour l'instant, l'objectif est de construire le site. Le dépôt de marque (INPI, 190 € la première classe) et le domaine swellcome.fr (libre au 6 novembre 2026) viendront ensuite. Le site démarrera sur un sous-domaine gratuit.

## Positionnement et concurrence

La personnalisation par niveau existe déjà chez plusieurs acteurs. Swellcome ne se distingue donc pas par la fonction, mais par trois choix combinés : un site web indexé avec une page par spot français, un contenu local en français natif, et des alertes gratuites en échange d'un compte.

| Acteur | Format | Personnalisation niveau | Alertes | Limite pour un surfeur français |
| --- | --- | --- | --- | --- |
| [Swellmates](https://www.swellmates.app/fr) | App iPhone, pas encore sortie | Oui (débutant, intermédiaire, avancé) | Oui, offre Pro payante | Pas de pages web indexées, couverture non précisée |
| [BreakFinder](https://breakfinder.surf/en/surf_spots/le-crohot-des-cavales) | Site + score personnalisé | Oui | Oui | International, contenu en anglais, 16 jours en premium |
| [Surfnerd](https://www.surfnerd.com/surf-forecast/le-crohot-des-cavales) | Site + app, compte obligatoire pour voir le forecast | Home spot, sessions | Oui (Telegram, WhatsApp, email) | Prix d'entrée : créer un compte avant de voir quoi que ce soit |
| [Surf-Forecast](https://www.surf-forecast.com/pages/app-store) | Site + app, plus de 7 000 spots | Notation générique | Oui | Mondial, lecture technique, pas d'adaptation au niveau |
| Surf-Report, Lacanau Surf Info | Sites français historiques | Non | Spots favoris | Forecast classique, sans verdict personnel |

L'angle retenu : le forecast reste ouvert à tous pour capter le trafic Google, et le compte apporte le verdict personnel et l'alerte. C'est l'inverse de Surfnerd, qui bloque le forecast derrière l'inscription.

## Forecast classique

Chaque spot de France métropolitaine a sa page publique, accessible sans compte : c'est le cœur du trafic. La couverture va de la Manche à la Méditerranée en passant par l'Atlantique, l'outre-mer pourra venir plus tard.

| Bloc | Données affichées | Pas de temps |
| --- | --- | --- |
| Houle | Hauteur, période et direction de la houle primaire et secondaire, mer du vent séparée | Heure par heure, 7 jours |
| Vent | Force, rafales, direction, et qualification offshore, side ou onshore selon l'orientation du spot | Heure par heure |
| Marée | Heures de pleine et basse mer, coefficient, hauteur d'eau | Jour par jour |
| Conditions | Température de l'eau, lever et coucher du soleil | Jour par jour |
| Fiche spot | Orientation, type de fond (sable, récif), marée qui fonctionne, niveau conseillé, dangers, accès et parking | Fixe, mise à jour à la main |

La fiche spot est ce qui transforme une donnée brute en verdict. Le vent offshore se calcule en comparant sa direction à l'orientation de la plage. La même houle n'a pas le même effet à Lacanau et à Hossegor. Cette base de spots doit être construite par Swellcome et pas copiée d'un concurrent (voir Sources de données).

Les pages sont organisées en région, puis département, puis spot, par exemple /gironde/lacanau-centrale. Cette structure sert le référencement sur des requêtes comme « surf Lacanau demain » ou « prévision surf Hossegor ».

## Personnalisation par niveau et surf alertes

Le compte transforme le forecast en réponse personnelle : est-ce une bonne journée pour moi, à mon spot, et à quelle heure. La création de compte est gratuite et c'est la seule condition pour recevoir des alertes.

L'inscription se fait en quatre étapes, en moins d'une minute :

1. Choisir son niveau parmi quatre.
2. Choisir son home spot, puis jusqu'à trois spots secondaires.
3. Ajuster ses critères, préremplis selon le niveau : taille de vague, période minimale, vent maximal, marée préférée, créneaux disponibles (matin, midi, soir, week-end).
4. Choisir le canal d'alerte : email au lancement, notification web ensuite.

Les critères par défaut ci-dessous sont un point de départ à valider avec des surfeurs et des moniteurs, pas une référence :

| Niveau | Taille de vague | Période | Vent | Spots proposés |
| --- | --- | --- | --- | --- |
| Débutant | 0,5 à 1 m | Peu importante | Faible, moins de 15 km/h | Fond sableux, avec une école, hors zone de baignade |
| Intermédiaire | 0,8 à 1,8 m | 8 s et plus | Offshore ou faible | Beach breaks |
| Confirmé | 1,2 à 2,5 m | 10 s et plus | Offshore ou faible | Beach breaks puissants, reefs |
| Expert | 2 m et plus | 12 s et plus | Offshore | Tous, y compris spots engagés |

Depuis le 9 novembre 2026, les hauteurs de ce tableau sont des tailles estimées au bord, pas des hauteurs au large. Le calcul (`site/assets/js/verdict.js`) combine chaque houle, sa période (coefficient de 0,35 à 5 s, 0,9 à 10 s, 1,2 à 14 s) et sa direction par rapport à l'orientation de la plage. Il ignore la mer du vent. Ces coefficients sont à caler sur le terrain. Sous 0,5 m au bord, le verdict est « à oublier » pour tous. En Gironde, les spots saturent vers 3 m (`saturation_m` dans les fiches) : à ce seuil, « à oublier » pour tous, et la zone idéale de l'expert s'arrête à 2,5 m.

Tolérances du verdict (`site/assets/js/verdict.js`), elles aussi à valider : hauteur jusqu'à 0,1 m sous le minimum ou 10 % au-dessus du maximum, période jusqu'à 2 s sous le minimum, vent faible de 15 à 20 km/h pour un débutant, vent de travers sous 22 km/h et vent de mer sous 18 km/h pour les niveaux intermédiaire et confirmé. Au-delà, le créneau est « à oublier ».

Chaque fiche spot porte aussi un niveau minimal, par exemple « réservé aux intermédiaires et plus ». Un débutant qui choisit ce spot voit un avertissement et ne reçoit pas d'alerte quand la houle dépasse son niveau.

Chaque créneau reçoit un verdict en trois états (top, correct, à oublier) et une phrase d'explication, par exemple « houle de 1,2 m à 11 s, vent offshore jusqu'à 10 h, marée montante ». L'alerte part la veille à 18 h et le matin à 7 h. Elle est limitée à une par jour et par spot pour ne pas lasser.

Une mention de sécurité figure sur chaque page : le forecast est une estimation, et il faut vérifier les conditions sur place et les drapeaux. Le surf est interdit dans les zones de baignade surveillées : ne jamais conseiller d'y surfer.

## Blog et infos locales

Le blog donne ce qu'aucun modèle ne calcule : l'état réel des spots. Exemple : « en ce moment, les bancs de sable du Porge Océan fonctionnent mieux à marée haute ». C'est le contenu qui différencie Swellcome des forecasts automatiques, et celui que Google et les LLM récupèrent le plus facilement.

Trois formats couvrent l'essentiel. Les notes de spot sont courtes, datées, et affichées directement sur la page du spot concerné (bancs de sable, marée qui marche, affluence). Les guides sont des articles de fond qui restent valables longtemps : lire un forecast, choisir son spot selon son niveau, comprendre la période. Les actus couvrent les grosses houles annoncées, les compétitions et les changements de réglementation sur les plages.

Chaque note de spot porte une date de mise à jour visible, car une info sur les bancs de sable périme en quelques semaines. À terme, les utilisateurs inscrits pourront proposer leurs propres notes, validées avant publication.

## Sources de données

Les concurrents ne possèdent pas de bouées : ils récupèrent les sorties de modèles numériques publics, puis les corrigent et les traduisent spot par spot. Swellcome peut faire pareil, avec des données publiques françaises et européennes, réutilisables gratuitement en citant la source.

Le modèle de vagues WaveWatch III, développé par la NOAA, sert de moteur à [presque tous les surf reports](https://www.surfertoday.com/surfing/wavewatch-wind-wave-forecast-model), souvent forcé par les vents du modèle américain GFS. En France, Météo-France fait tourner MFWAM au large, et le Shom fait tourner WW3 à la côte avec une résolution qui descend à 200 m. Les bouées servent à vérifier les modèles et à afficher les conditions en direct, pas à prévoir.

| Source | Ce qu'elle fournit | Conditions | Usage pour Swellcome |
| --- | --- | --- | --- |
| [Open-Meteo Marine](https://open-meteo.com/en/pricing) | API prête à l'emploi : houle, période, direction, vent | Données sous CC BY 4.0, API gratuite réservée au non commercial (10 000 appels par jour), abonnement payant pour un usage commercial | Prototype, puis abonnement ou remplacement dès que le site est monétisé |
| [Copernicus Marine](https://marine.copernicus.eu/news/wave-products-enter-copernicus-marine-service-19-april-2017) | Modèle MFWAM de Météo-France, houle primaire et secondaire, 10 jours | Ouvert et gratuit, citation obligatoire | Source principale de houle à terme |
| [Météo-France AROME](https://www.data.gouv.fr/fr/datasets/r/1f6017cd-1523-4cc3-80f9-1d7c84f4d155) | Vent à 2,5 km et 1,3 km de résolution | Licence Ouverte Etalab, mention « Source : Météo-France » | Vent précis à la côte |
| [Shom, modèles de vagues](https://services.data.shom.fr:/geonetwork/srv/api/records/OCEANO_MODELE_VAGUES.xml) | WW3 côtier jusqu'à 200 m, J à J+4 | Licence Ouverte 2.0, citer la source et la date | Houle à la côte, la plus fine disponible |
| [Candhis (Cerema)](https://www.data.gouv.fr/dataservices/api-de-candhis-observatoire-cotier-national-de-mesure-in-situ-des-etats-de-mer-france-metropole-et-outre-mer) | Une quarantaine de bouées en temps réel | Licence Ouverte Etalab, API avec jeton d'accès | Conditions mesurées en direct, contrôle du forecast |
| [Shom, prédictions de marée](https://api.data.shom.fr/support/en/node/4) | Heures, hauteurs, coefficients officiels | Payant : abonnement SUP Marée ou SAPM, licence de réutilisation | Seul point coûteux, alternative à trouver |

Réutiliser les données des concurrents est en revanche exclu. Un site comme Surf-Forecast est une base de données protégée par le droit sui generis du producteur. Ce droit interdit d'en extraire une partie substantielle. Le Boncoin a ainsi obtenu [70 000 € de dommages et intérêts](https://consultation.avocat.fr/blog/tanguy-allain/article-41711-web-scraping-attention-aux-droits-du-producteur-de-base-de-donnees.html) contre un site qui reprenait ses annonces. Pas de scraping de leurs forecasts ni de leur liste de spots, donc. Les faits eux-mêmes, comme l'existence d'un spot ou son orientation, restent libres : Swellcome construit sa propre base à partir du terrain et de sources ouvertes.

Ces points sont une lecture des licences, pas un avis juridique. Il faut relire chaque licence avant la mise en ligne et la réévaluer dès que le site génère des revenus.

## Questions ouvertes

Huit points restent à trancher avant ou pendant la construction.

- [ ] Prix exact de l'abonnement commercial Open-Meteo (non affiché sur la page tarifs), et savoir si un site gratuit sans publicité compte comme commercial
- [ ] Alternative gratuite aux marées du Shom : modèle harmonique ouvert, ou marées incluses dans une API déjà utilisée, licence à vérifier
- [ ] Sources exactes de Surf-Forecast et Surf-Report : non confirmées, à lire dans leurs pages « à propos » ou FAQ
- [ ] Source de la liste des spots : relevé manuel, ou OpenStreetMap (licence ODbL, qui impose de repartager la base sous la même licence)
- [ ] Critères par niveau à faire valider par deux ou trois moniteurs ou surfeurs confirmés
- [ ] Pseudo Instagram : @swellcome est pris, choisir entre @swellcome.fr, @swellcome_surf ou @getswellcome
- [ ] Hébergeur : comparer les offres gratuites de Vercel et Netlify sur les tâches planifiées, nécessaires pour envoyer les alertes
- [ ] Date de réservation de swellcome.fr et de dépôt de la marque

## Prochaines étapes

Le premier livrable est un prototype en ligne sur une seule zone, la Gironde, avant d'étendre à toute la France. On construit dans cet ordre, et chaque étape est utilisable seule :

1. **Prototype Gironde** : dix spots, de Soulac au Porge, avec forecast houle, vent et marée via Open-Meteo, hébergés sur un sous-domaine gratuit Vercel ou Netlify.
2. **Fiches spots** : orientation, fond, marée qui marche et niveau minimal pour chacun des dix spots, relevés à la main.
3. **Verdict par niveau** : calcul top, correct ou à oublier à partir des critères par défaut, visible sans compte avec un sélecteur de niveau.
4. **Comptes et alertes email** : inscription en quatre étapes, envoi la veille à 18 h et le matin à 7 h.
5. **Blog** : trois premières notes de spot et un guide « lire un forecast selon son niveau ».
6. **Extension** : Landes et Pays basque, puis Bretagne, Manche et Méditerranée.
7. **Passage aux sources publiques** (Copernicus, Météo-France, Shom) et réservation de swellcome.fr avant toute monétisation.

## Sources

[Swellmates](https://www.swellmates.app/fr) · [Open-Meteo, tarifs](https://open-meteo.com/en/pricing) · [Copernicus Marine](https://marine.copernicus.eu/news/wave-products-enter-copernicus-marine-service-19-april-2017) · [Météo-France AROME](https://www.data.gouv.fr/fr/datasets/r/1f6017cd-1523-4cc3-80f9-1d7c84f4d155) · [Shom, modèles de vagues](https://services.data.shom.fr:/geonetwork/srv/api/records/OCEANO_MODELE_VAGUES.xml) · [Candhis](https://candhis.cerema.fr/doc/01_UtilisationFR.pdf) · [Shom, marées](https://api.data.shom.fr/support/en/node/4) · [Droit sui generis et scraping](https://consultation.avocat.fr/blog/tanguy-allain/article-41711-web-scraping-attention-aux-droits-du-producteur-de-base-de-donnees.html) · [INPI, redevances](https://www.inpi.fr/inpi-block/download-document?id=20516)
