# AGENTS.md — Somatra Prototype

## Mission du dépôt

Ce dépôt contient un prototype commercial interactif destiné à démontrer le suivi du temps de préparation logistique par client et commande, puis la consolidation mensuelle pour la facturation.

Le prototype utilise exclusivement des données fictives. Il ne constitue pas une application de production.

## Périmètre actuel

- Frontend statique : `index.html`, `styles.css`, `app.js`.
- Aucun backend, aucune API et aucune authentification réelle.
- Persistance de démonstration limitée au `localStorage` du navigateur.
- Publication via GitHub Pages.

## Principes de travail

1. Lire `README.md` et le code existant avant toute modification.
2. Respecter le workflow défini dans `COMMITS.md`.
3. Préserver une interface française, mobile-first et utilisable sur un quai.
4. Garder les actions principales accessibles avec de grandes cibles tactiles.
5. Utiliser uniquement des données synthétiques et génériques.
6. Ne jamais ajouter de nom de salarié, de client final réel, de tarif contractuel, de secret ou de fichier `.env`.
7. Signaler clairement toute estimation ou règle métier fictive.
8. Ne pas introduire de backend ou de dépendance sans décision explicite.
9. Ne pas présenter ce prototype comme prêt pour la production.

## Vérifications obligatoires

Avant chaque PR :

```bash
node --check app.js
python3 -m http.server 8080 --bind 127.0.0.1
curl --fail http://127.0.0.1:8080/
```

Pour toute modification visuelle ou interactive :

- vérifier le parcours magasinier ;
- vérifier le parcours facturation ;
- vérifier l’export CSV si concerné ;
- contrôler les largeurs mobile et desktop ;
- vérifier l’absence d’erreurs JavaScript dans la console.

La GitHub Action doit être verte avant tout merge.

## Sécurité et passage en production

Toute évolution vers une application réelle nécessitera un cadrage séparé : utilisateurs et rôles, règles métier, validation des temps, protection des données, journal d’audit, sauvegardes, hébergement, authentification et intégration au système de facturation.
