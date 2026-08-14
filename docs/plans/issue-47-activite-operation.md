# Plan — issue #47 : activité d’une opération

**Version 1 — 2026-08-14**
**Base :** `feat/47-activite-operation` à `bd5aaae`

## 1. Encadrer la donnée dans `app.js`

- Définir une constante unique des six activités persistables et le libellé legacy `Non renseignée`.
- Ajouter des helpers pour valider une valeur courante et afficher une valeur historique : champ absent → fallback ; valeur inconnue → texte conservé puis échappé par chaque rendu.
- Étendre `loadOpenTasks` pour recopier `activity` lorsqu’elle existe, sans écrire au chargement. Ne changer ni les trois clés ni les migrations client existantes.

## 2. Saisir avant ou après le chronométrage (`index.html`, `app.js`)

- Ajouter dans **Nouvelle** un `select` facultatif dont l’option vide est **Choisir après**, suivi des six valeurs autorisées.
- Au démarrage, valider le choix contre la liste ; ajouter `activity` à la tâche uniquement si une activité réelle est choisie, puis réinitialiser référence et activité.
- Afficher dans chaque carte **En cours** l’activité ou `Non renseignée`, en conservant une activité indépendante par tâche.
- Ajouter à la confirmation un `select` obligatoire et son erreur accessible. Le préremplir uniquement avec l’activité autorisée de la tâche.
- Dans `saveEntry`, bloquer vide et valeur forgée, puis persister l’activité confirmée sur l’entrée. Garder le commentaire dans `comment`, sans concaténation.

## 3. Afficher et modifier dans Suivi (`app.js`, `styles.css`)

- Ajouter l’activité/fallback à la ligne compacte et à son `aria-label`.
- Ajouter un `select` obligatoire au formulaire d’édition ; une valeur absente ou historique inconnue commence sans sélection valide.
- Valider la valeur côté JavaScript puis l’inclure dans l’unique `Object.assign` de sauvegarde et dans `somatra-demo-entries-v1`.
- Ajuster seulement les styles nécessaires pour préserver densité, cibles tactiles, focus et absence d’overflow à 320/390 px.

## 4. Propager aux sorties partagées (`index.html`, `app.js`)

- PDF : ajouter une ligne `Activite : <libellé>` pour chaque saisie et renommer la ligne existante en `Commentaire : …`, sans changer filtres, pagination ni garde financière.
- Détail Facturation : insérer la colonne **Activité**, afficher le fallback ou la valeur historique échappée, et adapter le `colspan` vide.
- CSV : insérer **Activité** dans l’en-tête et la valeur correspondante dans chaque ligne, via l’échappement CSV existant.

## 5. Documentation (`README.md`)

- Décrire les deux moments de choix, l’obligation à la confirmation, l’édition dans **Suivi**, les cinq surfaces de restitution et la séparation du commentaire.
- Documenter `activity?` comme propriété additive, le fallback `Non renseignée`, l’absence de migration destructive et les clés inchangées.

## 6. Validation réelle attendue

1. Compatibilité `localStorage` : injecter entrées/tâches sans champ et avec valeur inconnue ; vérifier affichage, absence de réécriture au chargement et absence d’HTML exécuté.
2. Parcours avant : choisir chaque activité, démarrer, recharger, vérifier **En cours**, terminer, confirmer et recharger **Suivi**.
3. Parcours après : démarrer avec **Choisir après**, vérifier le blocage de confirmation vide/forgée, choisir une activité puis enregistrer.
4. Simultanéité : lancer deux tâches avec activités différentes ; pause/reprise/fin de l’une ne modifie pas l’autre.
5. Édition : modifier une activité dans **Suivi**, annuler puis enregistrer, recharger et contrôler la persistance ainsi que la survie du brouillon aux re-rendus prévus.
6. Sorties : vérifier activité et commentaire séparés dans liste, PDF non financier, détail Facturation et CSV filtré ; contrôler aussi le fallback legacy.
7. Interface : tester les deux profils en desktop, 390 px et 320 px, clavier/focus/ARIA, console et overflow.
8. Exécuter depuis la racine :

   ```bash
   node --check app.js
   git diff --check
   npx --yes prettier@3.8.4 --check README.md docs/research/issue-47-activite-operation.md docs/plans/issue-47-activite-operation.md
   ```

9. Exécuter le smoke HTTP d’`AGENTS.md`, puis vérifier que seuls les fichiers du ticket sont modifiés avec `git status --short` et `git diff --cached --check`.
