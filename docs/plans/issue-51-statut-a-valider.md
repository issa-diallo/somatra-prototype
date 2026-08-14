# Plan — issue #51 : statut À valider

**Version 1 — 2026-08-14**
**Base :** `fix/51-statut-a-valider` à `26125fe`

## 1. Centraliser le statut métier et sa compatibilité (`app.js`)

- Remplacer la liste persistable par **À valider** et **Validé**, et définir explicitement l’ancien libellé **À contrôler** uniquement pour la compatibilité de lecture.
- Ajouter une normalisation pure des entrées chargées : cloner chaque entrée legacy concernée avec `status: "À valider"`, sans `localStorage.setItem`, reset, nouvelle clé ou mutation des tâches ouvertes.
- Appliquer cette normalisation au résultat de `loadEntries`, après le traitement client existant, afin que Suivi, filtres, PDF, CSV et Facturation consomment tous le même statut canonique en mémoire.
- Laisser toute autre valeur historique inchangée et échappée dans les rendus. Ne toucher à aucun test ou traitement de `running`/`paused`.

## 2. Produire uniquement le nouveau parcours (`app.js`)

- Passer les deux seeds à **À valider** et enregistrer chaque préparation finalisée directement avec ce statut.
- Conserver la validation stricte de l’édition contre les deux valeurs autorisées, pour permettre seulement **À valider → Validé** ou une correction explicite.
- Si une entrée porte un statut inconnu, afficher dans le sélecteur un placeholder invalide et sélectionné plutôt que de présélectionner silencieusement **À valider** ; bloquer l’enregistrement tant qu’un statut autorisé n’est pas choisi.

## 3. Propager le libellé aux interfaces et sorties (`index.html`, `app.js`)

- Dans le filtre Facturation, remplacer l’option **À contrôler** par **À valider** sans ajouter de filtre au Suivi.
- Adapter les comparaisons, compteurs et libellés de la synthèse Facturation : nombre de saisies **à valider**, agrégation client et badge de groupe **À valider** lorsqu’au moins une entrée l’est.
- Vérifier que ligne et édition Suivi, détail Facturation, PDF et CSV rendent le statut normalisé. Utiliser la valeur canonique commune plutôt que des remplacements indépendants dans chaque export.
- Conserver les classes visuelles `review`/`valid`, les filtres courants, les montants fictifs et l’absence de finance dans Suivi/PDF.

## 4. Mettre la documentation à jour (`AGENTS.md`, `README.md`)

- Remplacer le contrat des statuts éditables par **À valider** et **Validé**, puis décrire le parcours de finalisation et de validation.
- Documenter la lecture compatible de **À contrôler**, l’absence de réécriture obligatoire ou migration destructive, les trois clés inchangées et l’exclusion de `running`/`paused`.
- Ne pas modifier `BRIEF-PROTOTYPE.md`, qui ne prescrit aucun statut.

## 5. Validation réelle attendue

1. État neuf : après reset, vérifier que les seeds à revoir affichent **À valider** dans Suivi, Facturation, détail, PDF et CSV, sans occurrence fonctionnelle de **À contrôler**.
2. Parcours courant : finaliser une préparation avec activité choisie avant, puis une avec activité choisie après ; chacune doit ouvrir Suivi avec **À valider**, puis pouvoir passer à **Validé** par l’édition.
3. Compatibilité : injecter une entrée stockée **À contrôler**, conserver sa valeur brute, recharger et vérifier **À valider** dans Suivi, filtre Facturation, synthèse/détail, PDF et CSV ; confirmer que le chargement seul n’a pas réécrit la clé.
4. Valeur inconnue : injecter un statut synthétique inconnu ; vérifier son affichage sûr, l’absence de conversion silencieuse et le blocage de sauvegarde jusqu’au choix explicite de **À valider** ou **Validé**.
5. Chronomètres : injecter puis utiliser des tâches `running` et `paused`, recharger, pauser/reprendre/finaliser l’une et confirmer que leurs états et durées restent indépendants et inchangés par la normalisation.
6. Filtres et sorties : tester **Tous**, **À valider** et **Validé**, les compteurs/groupes, le détail, le contenu texte du PDF et les cellules CSV avec seeds et entrée legacy.
7. Non-régression : reset, activités avant/après, brouillon d’édition, profils distincts, console, clavier et absence d’overflow en desktop, 390 px et 320 px.
8. Exécuter depuis la racine :

   ```bash
   node --check app.js
   git diff --check
   npx --yes prettier@3.8.4 --check AGENTS.md README.md docs/research/issue-51-statut-a-valider.md docs/plans/issue-51-statut-a-valider.md
   ```

9. Exécuter les tests ciblés et le smoke HTTP d’`AGENTS.md`, rechercher **À contrôler** pour contrôler chaque exception legacy/documentaire, puis confirmer avec `git status --short` et `git diff --cached --check` que seuls les fichiers du ticket sont modifiés.
