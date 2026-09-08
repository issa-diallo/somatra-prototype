# Somatra — relevés magasinier

[![Démo publique](https://img.shields.io/badge/d%C3%A9mo_GitHub_Pages-ouvrir-0969da?logo=github)](https://issa-diallo.github.io/somatra-prototype/)

Prototype web statique, responsive et mobile-first destiné au magasinier pour suivre les préparations et produire des relevés mensuels par client.

> [!WARNING]
> Démonstration commerciale uniquement, avec données synthétiques. L’état reste dans le `localStorage` du navigateur : aucune authentification, aucun backend, aucune base partagée et aucune transmission réelle.

## Fonctionnalités

- Ouverture directe de l’espace **Magasinier**, sans choix de profil.
- Présentation mobile de type application opérationnelle : en-tête compact, contrôles tactiles, CTA principal persistant et navigation basse compatible avec les safe areas.
- Parcours **Nouvelle**, **En cours** et **Suivi**, plus gestion des données de démonstration.
- Scan local ou saisie manuelle d’une référence libre de 120 caractères maximum.
- Plusieurs chronomètres simultanés, indépendants et persistants entre les rechargements.
- Activité contrôlée et département facultatif (80 caractères maximum), conservés par préparation.
- Édition du client, de la référence, de la date, du département, de l’activité, de l’opérateur, de la durée et du statut.
- Suivi dense par lots de 20, filtres mois/client/préparation et KPI calculés sur tous les résultats filtrés.
- Relevé PDF individuel : bandeau client et mois, tableau **Date / Département / Activité / Nom / Temps**, puis total mensuel en minutes.
- Archive ZIP locale contenant exactement un PDF non vide par client du mois et de la préparation filtrés.
- Noms de fichiers explicites, sûrs et déterministes.
- Téléchargement et envoi simulé fondés sur le même artifact préparé en mémoire : aucune régénération divergente et aucune requête réseau.

## Parcours de démonstration

1. L’application ouvre directement **Nouvelle**.
2. Saisir ou scanner une référence, renseigner éventuellement le département et l’activité, puis démarrer.
3. Dans **En cours**, pauser, reprendre ou terminer chaque préparation indépendamment.
4. À la fin, corriger la durée, confirmer l’activité et, si besoin, le département.
5. Dans **Suivi**, choisir un mois et un client pour préparer son PDF, ou choisir **Télécharger tous les clients** pour préparer le ZIP du périmètre filtré.
6. Vérifier le récapitulatif (mois, portée, nombre de PDF, format), télécharger ou simuler l’envoi du même fichier.

## Lancer et valider localement

```bash
python3 -m http.server 8080 --bind 127.0.0.1
# ouvrir http://127.0.0.1:8080/

node --check app.js
node --check report-utils.js
node --test tests/*.test.js
```

Aucune installation de dépendance n’est nécessaire. `report-utils.js` construit les PDF et ZIP directement dans le navigateur.

## Fichiers

- `index.html` : vues, formulaires, dialogues et navigation.
- `styles.css` : interface responsive et tactile.
- `app.js` : stockage local, chronomètres, scan, filtres, édition, reset et orchestration des relevés.
- `report-utils.js` : génération déterministe des octets PDF/ZIP, sans dépendance.
- `tests/` : tests ciblés Node.js.
- `.github/workflows/ci-pages.yml` : validation et publication GitHub Pages.

## Stockage local et compatibilité

Le prototype conserve exactement trois clés :

- `somatra-demo-entries-v1` : saisies enregistrées ;
- `somatra-demo-clients-v1` : clients et commandes synthétiques ;
- `somatra-demo-open-preparations-v1` : préparations et chronomètres ouverts.

Les propriétés `activity` et `department` sont additives et facultatives. Les anciennes données sans département restent lisibles avec **Non renseigné** et ne sont pas réécrites au chargement. L’ancien statut exact **À contrôler** est interprété en mémoire comme **À valider**, sans migration destructive.

**Tout réinitialiser** écrit `[]`, `{}` et `[]` dans les trois clés, sans toucher aux autres données de l’origine. **Charger la démo complète** restaure le jeu synthétique. Les écritures sont vérifiées et compensées en cas d’échec.

## Relevés et sécurité

Les PDF et ZIP sont générés localement. Un relevé n’est jamais créé sans ligne. L’archive ZIP utilise le format standard sans compression et peut être extraite avec un outil ZIP courant. Les champs libres portant un indicateur financier sont entièrement masqués dans les documents opérationnels.

L’action d’envoi est une simulation : elle réutilise la même référence d’octets que le téléchargement et n’appelle ni `fetch`, ni XHR, ni `sendBeacon`, ni service externe.

Le stockage local n’est ni partagé ni protégé par des rôles réels. Toute personne utilisant le même profil de navigateur peut consulter ou modifier les données de démonstration. Une mise en production nécessiterait notamment backend, authentification, autorisations, stockage partagé, audit, tests complets et analyse de sécurité.

## CI et déploiement

La CI vérifie la syntaxe JavaScript, la structure HTML et le smoke HTTP. Les pull requests valident sans publier ; seul un push sur `main` publie GitHub Pages.
