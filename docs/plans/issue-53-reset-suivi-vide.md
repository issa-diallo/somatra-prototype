# Plan — issue #53 : Suivi vide après réinitialisation

**Version 1 — 2026-08-14**

**Base :** `fix/53-reset-suivi-vide` à `e8c83d6`

## 1. Remplacer la suppression par un état vide (`app.js`)

- Associer aux trois constantes existantes leurs chaînes canoniques : `STORAGE_KEY → '[]'`, `CLIENTS_STORAGE_KEY → '{}'`, `OPEN_TASKS_STORAGE_KEY → '[]'`.
- Dans `resetDemo()`, conserver le verrou anti-double confirmation et prendre le snapshot brut complet des trois clés avant toute mutation.
- Écrire les trois valeurs avec `setItem`, sans `clear()` et sans toucher à une autre clé, puis vérifier par `getItem` leur égalité stricte avec les chaînes attendues.
- Ne modifier ni les chargeurs ni les seeds : une clé absente continue de représenter le premier lancement; une clé présente avec une structure vide représente le reset confirmé.

## 2. Garantir l’état vide immédiat (`app.js`)

- Seulement après les trois écritures vérifiées, remplacer l’état mémoire par des entrées, clients, tâches ouvertes et attributions de références vides.
- Réinitialiser les états dérivés devenus invalides, notamment `pendingTask`, `editingEntryId` et la limite visible du Suivi, puis rerendre Suivi, tâches ouvertes et filtres partagés.
- Déclencher ensuite le rechargement. Au chargement suivant, les trois structures vides doivent être relues telles quelles; aucun seed ne doit être persisté ou affiché.
- Vérifier que l’allocateur repart d’une `Map` vide afin que la prochaine référence inconnue reçoive **Client A**.

## 3. Rendre la compensation exacte (`app.js`)

- Adapter `restoreResetSnapshot()` pour restaurer systématiquement les trois valeurs brutes : `setItem(key, valeur)` si la valeur existait, `removeItem(key)` seulement si le snapshot valait `null`.
- Après compensation, relire chaque clé et comparer strictement sa valeur au snapshot; traiter une différence comme un échec de compensation.
- Sur erreur de lecture initiale, ne lancer aucune écriture. Sur erreur d’écriture ou de vérification, ne jamais modifier l’état mémoire, fermer le dialogue ou recharger.
- Réactiver la confirmation et afficher le message d’échec existant si la compensation est exacte; afficher le message d’incertitude si une restauration ou sa vérification échoue.
- Préserver les sorties sans effet : ouverture, `Annuler`, croix, Échap et backdrop ne doivent appeler aucun accès `localStorage`.

## 4. Aligner les textes (`index.html`, `README.md`)

- Dans le dialogue, annoncer qu’après confirmation `Suivi`, clients/références et préparations ouvertes seront vides; supprimer la promesse de restauration des données initiales.
- Dans le README, remplacer la suppression des clés par l’écriture de `[]`, `{}`, `[]`, expliquer la distinction premier lancement/reset confirmé et conserver les garanties de clé étrangère intacte, compensation et absence de réseau.
- Ne modifier ni styles ni structure du dialogue : accessibilité, focus sûr et comportement responsive actuels restent adaptés.

## 5. Validation ciblée

1. **Annulation sans accès stockage** : instrumenter `getItem`, `setItem`, `removeItem` et `clear`; ouvrir puis quitter par `Annuler`, croix, Échap et backdrop. Attendre zéro appel pour chaque sortie.
2. **Seeds** : partir des données initiales, confirmer; avant le reload observé, vérifier l’état mémoire et le rendu `Suivi` à zéro, puis les valeurs exactes `[]`, `{}`, `[]`.
3. **État utilisateur** : injecter une saisie, un client et une tâche ouverte, plus une clé étrangère; confirmer et vérifier les trois écritures ciblées, aucun `clear`, aucune mutation de la clé étrangère et aucune préparation ouverte.
4. **Persistance** : recharger réellement; vérifier `Suivi` vide, KPI et filtres cohérents, Facturation vide et trois valeurs inchangées. Recharger une seconde fois pour exclure tout reseed tardif.
5. **Allocation** : démarrer une référence inconnue après reset et constater **Client A**; recharger et vérifier sa stabilité. Une référence seed connue doit garder son client connu sans consommer la séquence.
6. **Erreurs injectées** : faire échouer chacune des trois écritures et chacune des trois relectures de vérification, notamment après mutation partielle; vérifier les trois snapshots exacts, clé absente comprise, état mémoire inchangé, erreur visible et aucun reload.
7. **Compensation dégradée** : faire échouer une restauration ou sa relecture; vérifier le message d’incertitude et l’absence de succès/reload.
8. **Non-régression** : contrôler activité, statut **À valider**, PDF, Facturation, navigation et reset à 390 px; vérifier clavier, focus, ARIA et console.
9. Exécuter depuis la racine :

   ```bash
   node --check app.js
   git diff --check
   npx --yes prettier@3.8.4 --check README.md docs/research/issue-53-reset-suivi-vide.md docs/plans/issue-53-reset-suivi-vide.md
   ```

10. Exécuter le smoke HTTP d’`AGENTS.md`, puis `git diff --cached --check` et `git status --short`; seuls les fichiers du ticket doivent être modifiés.
