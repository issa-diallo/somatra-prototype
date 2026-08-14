# Somatra — prototype de suivi des préparations

[![Démo publique](https://img.shields.io/badge/d%C3%A9mo_GitHub_Pages-ouvrir-0969da?logo=github)](https://issa-diallo.github.io/somatra-prototype/)

Prototype web statique, responsive et mobile-first pour démontrer le suivi du temps de préparation logistique et sa consolidation mensuelle.

> [!WARNING]
> **Démonstration commerciale uniquement.** Toutes les données et tous les montants sont fictifs. L’état est conservé dans le `localStorage` du navigateur : il n’existe ni authentification, ni backend, ni base partagée, ni facturation réelle. Ce prototype n’est pas adapté à la production.

## Fonctionnalités

### Profil Magasinier

- Identité opérateur simulée et non modifiable **Magasinier démo**, automatiquement associée aux nouvelles préparations ; le profil reste opérationnel et les saisies restent éditables.
- Scan local de QR codes et codes-barres avec la caméra lorsque le navigateur le permet, ou saisie manuelle d’une référence.
- Acceptation de toute référence non vide de **120 caractères maximum**, sans résolution ni validation par un référentiel backend. Le scan remplit le champ ; le démarrage reste une action explicite.
- Attribution locale des références inconnues à **Client A**, puis **Client B**, **Client C**, etc. (AA après Z). Une même référence normalisée conserve son client après rechargement ; les attributions déjà stockées et leurs suffixes sont préservés, tandis que les commandes fictives initiales ne consomment pas la séquence. En cas d’anciennes données conflictuelles pour une référence, la première attribution valide des saisies, puis des tâches ouvertes, prévaut ; une modification explicite propage le nouveau client à toute la référence.
- Suivi de plusieurs préparations simultanées et indépendantes, avec pause, reprise et fin individuelles.
- Persistance des préparations ouvertes et de leur chronométrage, y compris après actualisation ou fermeture de la page.
- Confirmation et correction de la durée avant enregistrement, avec commentaire facultatif limité à **240 caractères**.
- Vue **Suivi** sans prix ni montant financier :
  - liste compacte adaptée au tactile ;
  - affichage initial de 20 lignes, puis chargement par lots de 20 ;
  - filtres par mois, client/commande et référence de préparation, repliables sur mobile ;
  - KPI calculés sur **toutes** les saisies correspondant aux filtres, même lorsque seules les 20 premières lignes sont rendues ;
  - modification au clic d’une ligne : client/commande, référence, date, durée et statut ;
  - statut limité aux valeurs proposées **À contrôler** et **Validé** ;
  - relevé mensuel PDF réel basé sur le mois et les filtres actifs, affiché dans le navigateur et téléchargeable, sans donnée financière, paginé par saisie et incluant l’opérateur ainsi que le commentaire lorsqu’ils existent ;
  - simulation explicite de son envoi au service facturation, sans e-mail, API ni requête réseau.

### Profil Facturation

- Synthèse mensuelle fictive en CHF : clients, préparations, temps total et montant estimé.
- Filtres par mois, client et statut.
- Détail des préparations d’un client.
- Export CSV des résultats filtrés, avec des montants estimés en CHF calculés selon un tarif fictif.

Les informations financières et l’export CSV sont visibles uniquement dans l’interface **Facturation** ; aucun prix n’apparaît dans l’interface **Magasinier** ni dans son relevé PDF. Cette séparation est simulée et ne repose sur aucune authentification réelle.

## Parcours de démonstration

1. Sur l’écran **Profil**, choisir **Magasinier** ; l’application ouvre le menu **Nouvelle**.
2. Scanner un QR code/code-barres ou saisir une référence, puis appuyer explicitement sur le bouton de démarrage.
3. Dans **En cours**, lancer éventuellement d’autres préparations, puis mettre en pause, reprendre ou terminer chacune indépendamment.
4. À la fin d’une préparation, ajuster si nécessaire la durée et confirmer l’enregistrement.
5. Dans **Suivi**, filtrer les saisies, consulter les KPI, toucher une ligne pour modifier ses informations, puis sélectionner un mois afin d’afficher, télécharger et simuler l’envoi du relevé PDF non financier.
6. Revenir à **Profil** et choisir **Facturation**.
7. Dans **Facturation**, filtrer la synthèse, ouvrir le détail d’un client puis exporter le CSV fictif.

## Lancer localement

L’application ne nécessite ni Node.js ni installation de dépendances pour s’exécuter. Depuis la racine du dépôt :

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Ouvrir ensuite <http://127.0.0.1:8080/>.

Node.js est facultatif en local et sert uniquement, si souhaité, à vérifier la syntaxe JavaScript (la CI utilise Node.js 24) :

```bash
node --check app.js
```

## Architecture et fichiers

- `index.html` : structure des vues, formulaires et navigation.
- `styles.css` : interface responsive, mobile-first et adaptée aux interactions tactiles.
- `app.js` : état de démonstration, attribution des clients, chronomètres, filtres, édition, PDF local, synthèse et export CSV.
- `assets/` : ressources statiques, dont le logo Somatra.
- `.github/workflows/ci-pages.yml` : validation et publication GitHub Pages.
- `BRIEF-PROTOTYPE.md` : objectifs, contraintes et périmètre fonctionnel du prototype.

## Stockage local et réinitialisation

L’application utilise ou peut lire trois clés :

- `somatra-demo-entries-v1` : saisies enregistrées ;
- `somatra-demo-clients-v1` : clients et commandes fictifs ; cette clé peut être lue, mais n’est plus écrite dans le flux courant ;
- `somatra-demo-open-preparations-v1` : préparations ouvertes et état des chronomètres.

Effacer ces trois clés dans les outils de développement du navigateur, puis recharger la page, réalise un reset complet et restaure l’état initial fictif. Si le `localStorage` est indisponible ou bloqué, le prototype peut rester utilisable pendant la session, sans garantie de persistance.

## CI et déploiement

Le workflow GitHub Actions :

1. utilise Node.js **24** pour exécuter `node --check app.js` ;
2. contrôle la présence des fichiers attendus et la structure HTML ;
3. effectue un smoke test HTTP sur la page et ses ressources statiques ;
4. publie l’artefact sur GitHub Pages après validation d’un `push` sur `main`.

Les pull requests vers `main` exécutent la validation sans publier le site. Le workflow peut également être lancé manuellement.

## Sécurité et confidentialité

- Utiliser uniquement les données synthétiques fournies ; ne saisir aucune donnée personnelle, client ou commande réelle.
- Le flux caméra est analysé localement par le navigateur : aucune image n’est envoyée ni stockée par l’application.
- Le scan dépend de `getUserMedia`, de `BarcodeDetector`, d’une caméra compatible, de l’autorisation de l’utilisateur et des règles de contexte sécurisé du navigateur. La prise en charge varie selon le navigateur et l’appareil ; la saisie manuelle reste disponible.
- Le stockage est local au navigateur, sans chiffrement applicatif, synchronisation serveur ni contrôle d’accès : toute personne utilisant le même profil de navigateur peut potentiellement consulter ou modifier l’état de démonstration. Le PDF est construit dans le navigateur sous forme de `Blob` `application/pdf` et sa simulation d’envoi ne transmet rien.

## Limites avant une mise en production

Une application réelle nécessiterait notamment :

- un backend et un référentiel fiable des commandes et clients ;
- une authentification réelle, des rôles et des contrôles d’accès ;
- une persistance partagée, synchronisée, sauvegardée et résiliente ;
- des règles d’autorisation pour l’édition, la validation des temps et un journal d’audit ;
- une intégration cadrée au système de facturation, sans tarif de démonstration ;
- une stratégie de tests complète (unitaires, intégration, bout en bout, compatibilité et accessibilité) ;
- une analyse de sécurité et de confidentialité, la protection des données, la supervision et un hébergement adaptés.

Ces éléments sont hors du périmètre du prototype actuel.
