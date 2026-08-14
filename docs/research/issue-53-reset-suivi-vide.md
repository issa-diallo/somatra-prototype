# Recherche — issue #53 : Suivi vide après réinitialisation

**Version 1 — 2026-08-14**

**Ticket :** [#53 — Vider entièrement Suivi après réinitialisation](https://github.com/issa-diallo/somatra-prototype/issues/53)

## Besoin confirmé

Après confirmation de **Réinitialiser clients et données**, `Suivi` doit contenir zéro saisie immédiatement et après rechargement. Les préparations ouvertes, clients et références enregistrés doivent aussi disparaître. Le prochain code inconnu doit repartir sur **Client A**.

L’annulation sous toutes ses formes ne doit ni lire ni écrire le stockage. Une clé étrangère reste intacte. En cas d’échec, les trois valeurs initiales doivent être restaurées exactement, sans `localStorage.clear()`.

## Cause actuelle

- `app.js:1234-1248` prend un snapshot, supprime les trois clés avec `removeItem`, vérifie leur absence, puis recharge.
- `app.js:63-72` interprète l’absence de la clé des saisies comme un premier lancement et recharge `seedEntries`.
- `app.js:85-90` fait de même pour les clients avec `seedOrders`; les tâches ouvertes absentes deviennent déjà `[]` (`app.js:94-117`).
- Le reset de l’issue #49 cherchait explicitement à restaurer les seeds. Ce contrat est désormais remplacé par l’issue #53.

La suppression réussit donc techniquement, mais rend le reset indiscernable d’un premier lancement.

## Contrat corrigé

Le reset confirmé doit écrire des JSON vides valides dans les constantes et clés existantes :

| Constante                | Clé                                 | Valeur exacte |
| ------------------------ | ----------------------------------- | ------------- |
| `STORAGE_KEY`            | `somatra-demo-entries-v1`           | `[]`          |
| `CLIENTS_STORAGE_KEY`    | `somatra-demo-clients-v1`           | `{}`          |
| `OPEN_TASKS_STORAGE_KEY` | `somatra-demo-open-preparations-v1` | `[]`          |

Aucune nouvelle clé ni version de schéma n’est nécessaire. Les chargeurs actuels acceptent déjà ces valeurs : `'[]'` est présent et se parse en tableau, tandis que `'{}'` est un objet client valide. Les seeds restent réservés au cas où les clés sont absentes ou invalides; ils ne réapparaissent donc pas après un reset explicite.

Avec entrées et tâches vides, `buildReferenceClientAssignments()` reconstruit une `Map` vide. `clientForReference()` alloue alors l’index 0, soit **Client A**, à la prochaine référence inconnue. Les références seed restent reconnues par `seedOrders` sans être persistées.

## Cohérence mémoire et stockage

Le succès ne doit pas dépendre uniquement du rechargement : après écriture et vérification des trois chaînes attendues, basculer l’état mémoire vers `entries = []`, `orders = {}`, `openTasks = []` et une attribution de références vide, puis rerendre les surfaces dérivées avant `window.location.reload()`. Ainsi `Suivi` est vide immédiatement, même si le rechargement est retardé ou doublé dans un test.

Aucune donnée mémoire ne doit changer avant la réussite complète du stockage. Les états dérivés liés à une saisie ou tâche (`pendingTask`, édition et limites de Suivi) doivent être remis à leur valeur initiale uniquement sur ce chemin de succès.

## Échec et compensation exacte

Avant toute écriture, lire les trois valeurs brutes avec `getItem` et conserver pour chaque clé la chaîne exacte ou `null`. Si cette phase échoue, ne rien écrire.

Ensuite :

1. écrire chaque valeur canonique avec `setItem`;
2. relire les trois clés et exiger l’égalité stricte avec `[]`, `{}`, `[]`;
3. sur toute exception ou différence, restaurer les trois snapshots : `setItem` pour une chaîne initiale, `removeItem` uniquement si elle était absente;
4. relire et comparer chaque valeur au snapshot exact;
5. garder le dialogue ouvert, l’état mémoire intact et ne pas recharger.

La compensation doit couvrir les trois clés, y compris celle dont l’écriture a échoué, car une doublure peut muter avant de lever. Si la restauration ou sa vérification échoue, le message doit signaler l’incertitude sans annoncer de succès. `localStorage.clear()` reste interdit; aucune clé étrangère ne doit être lue, écrite ou supprimée.

## Interface, documentation et périmètre

- `index.html:221-229` annonce encore la restauration des données initiales : remplacer ce texte par l’état vide de `Suivi`, des clients et des préparations ouvertes.
- `README.md:79-91` décrit encore la suppression des clés et le retour des seeds : documenter les trois écritures canoniques et la compensation.
- Les chemins d’ouverture, `Annuler`, croix, Échap et backdrop (`app.js:1208-1219, 1330-1344`) sont déjà purement DOM; ils doivent rester sans accès au stockage.
- Aucun changement de seed, clé, style, dépendance, backend, activité, statut, PDF, Facturation ou navigation mobile n’est requis.

L’implémentation future devrait donc toucher uniquement `app.js`, `index.html` et `README.md`.
