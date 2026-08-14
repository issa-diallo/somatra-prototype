# Plan — issue #49 : réinitialisation complète de la démo

**Version 1 — 2026-08-14**
**Base :** `feat/49-reset-demo` à `8d65df4`

## 1. Ajouter le point d’entrée et le dialogue (`index.html`)

- Sous les choix Magasinier/Facturation, ajouter le bouton explicite `Réinitialiser clients et données`, distinct des cartes de profil.
- Ajouter un `<dialog>` dédié avec titre et description accessibles, une croix libellée, et le détail des quatre conséquences validées : clients/références, préparations/chronomètres, temps/modifications locales, restauration des seeds.
- Ajouter les actions `Annuler` et `Tout réinitialiser`, cette dernière clairement destructive, ainsi qu’une zone d’erreur masquée avec `role="alert"` et annonce live.

## 2. Encadrer l’ouverture et les sorties sans effet (`app.js`)

- À l’ouverture, effacer une ancienne erreur, mémoriser le déclencheur, appeler `showModal()` et placer le focus sur `Annuler`.
- Faire converger `Annuler`, croix, événement `cancel` (Échap) et éventuel clic sur le backdrop vers une fermeture unique qui ne lit ni ne modifie le stockage.
- Après fermeture, restituer le focus au bouton déclencheur. Ne brancher aucune suppression sur un événement générique de fermeture.

## 3. Réinitialiser exclusivement les trois clés (`app.js`)

- Construire une liste locale depuis `STORAGE_KEY`, `CLIENTS_STORAGE_KEY` et `OPEN_TASKS_STORAGE_KEY` ; ne coder aucune autre clé et ne jamais appeler `localStorage.clear()`.
- Sur `Tout réinitialiser`, empêcher une double exécution, prendre un instantané des trois valeurs avant mutation, puis appeler `localStorage.removeItem(key)` une fois pour chaque clé.
- Vérifier que les trois clés sont absentes. Seulement après réussite complète, appeler `window.location.reload()` ; ne pas vider ni rerendre manuellement `entries`, `orders`, `openTasks` ou les attributions client.
- Si une lecture, une suppression ou la vérification échoue, compenser au mieux les suppressions déjà réalisées à partir de l’instantané, garder l’état mémoire courant, réactiver l’action, afficher et focaliser/annoncer une erreur, sans fermer ni recharger.

## 4. Rendre l’action accessible et mobile (`styles.css`)

- Ajouter un style secondaire destructif professionnel utilisant le rouge existant, avec focus visible et contraste suffisant, sans faire ressembler le bouton aux profils.
- Dimensionner déclencheur, fermeture et actions à au moins 48 px ; limiter largeur/hauteur du dialogue et autoriser son contenu à défiler.
- À 390 et 320 px, empiler les actions et conserver texte, listes et boutons dans la largeur disponible, sans overflow global.

## 5. Documenter (`README.md`)

- Remplacer la seule procédure manuelle de reset par le parcours via **Profil**, la confirmation détaillée, les trois clés ciblées et le comportement d’erreur sans rechargement.
- Conserver la procédure outils de développement comme repli éventuel et rappeler qu’aucune clé étrangère, donnée réelle ou transmission réseau n’est concernée.

## 6. Validation réelle attendue

1. Avant confirmation : placer des valeurs distinctes dans les trois clés Somatra et une clé étrangère ; vérifier que ouverture, `Annuler`, croix, Échap et backdrop laissent les quatre valeurs strictement inchangées.
2. Succès : confirmer, espionner les appels pour constater exactement les trois `removeItem` et aucun `clear`, puis vérifier que la clé étrangère subsiste et que le rechargement a lieu uniquement après les trois suppressions.
3. État restauré : après reload, vérifier les seeds, aucune préparation ouverte, vue **Profil**, puis créer une référence inconnue et constater **Client A**.
4. Échec : simuler une exception de `removeItem` sur chacune des trois positions ; vérifier erreur visible/annoncée, absence de reload, état mémoire inchangé et compensation des clés déjà retirées. Simuler aussi un échec de compensation et vérifier qu’aucun succès n’est annoncé.
5. Robustesse : confirmer deux fois rapidement et vérifier une seule séquence ; tester aussi des clés déjà absentes.
6. Interface : parcourir au clavier (ordre, focus initial, piège modal, restitution), contrôler libellés/ARIA, console, cibles >= 48 px et absence d’overflow en desktop, 390 px et 320 px.
7. Non-régression : ouvrir ensuite Magasinier et Facturation ; vérifier navigation, préparations/chronomètres, Suivi, PDF, scan et export sans changement métier.
8. Exécuter depuis la racine :

   ```bash
   node --check app.js
   git diff --check
   npx --yes prettier@3.8.4 --check README.md docs/research/issue-49-reset-demo.md docs/plans/issue-49-reset-demo.md
   ```

9. Exécuter le smoke HTTP d’`AGENTS.md`, puis confirmer avec `git status --short` et `git diff --cached --check` que seuls les fichiers du ticket sont modifiés.
