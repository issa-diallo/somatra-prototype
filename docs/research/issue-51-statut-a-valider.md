# Recherche — issue #51 : statut À valider

**Version 1 — 2026-08-14**
**Ticket :** [#51 — Passer les commandes terminées directement à À valider](https://github.com/issa-diallo/somatra-prototype/issues/51)

## Besoin confirmé

Après finalisation, une préparation doit apparaître dans **Suivi** avec le statut exact **À valider**, jamais **À contrôler**. Le seul parcours métier proposé devient **À valider → Validé**. Ce libellé doit rester cohérent dans l’édition, le filtre Facturation, le PDF, la synthèse et le détail Facturation, ainsi que le CSV.

Une ancienne entrée stockée avec `status: "À contrôler"` doit être interprétée comme **À valider** dès la lecture. Cette compatibilité ne doit ni réinitialiser les données, ni ajouter ou renommer une clé, ni imposer une réécriture du stockage au chargement.

## État du code

- `app.js:16,25-32` centralise les deux statuts éditables et les seeds ; deux seeds utilisent encore **À contrôler**.
- `app.js:60-69` charge les entrées. `migrateLegacyClients` traite seulement l’ancien client et peut écrire pour cette migration distincte ; aucun traitement du statut n’existe.
- `app.js:603-639` enregistre toute nouvelle préparation avec **À contrôler**.
- `app.js:716-815` construit l’édition **Suivi**, valide contre `ENTRY_STATUSES` et persiste le statut. Avec une valeur historique inconnue, aucune option n’est sélectionnée explicitement et le navigateur choisirait actuellement la première : il faut éviter cette correction silencieuse.
- `app.js:733-852` affiche le statut dans la ligne et son nom accessible. Le style distingue seulement `Validé` des états à revoir et peut être conservé.
- `index.html:156-160` porte l’unique filtre de statut, dans **Facturation**. Les filtres **Suivi** portent seulement sur mois, client et préparation : le ticket n’exige pas d’en inventer un nouveau.
- `app.js:854-906` filtre, compte, groupe et rend la synthèse et le détail Facturation avec des comparaisons et libellés **À contrôler**.
- `app.js:919-924` exporte directement `entry.status` en CSV ; `app.js:1029-1039` l’insère directement dans le PDF. Une normalisation commune en amont les couvrira.
- `AGENTS.md:70-71` et `README.md:22-30` documentent encore les anciens statuts. Le brief ne fixe aucun libellé de statut et n’a pas à changer.
- La CI contrôle syntaxe, structure HTML et ressources HTTP, mais aucun comportement `localStorage`, PDF ou CSV.

## Contrat de données et compatibilité

Les trois clés restent exactement :

- `somatra-demo-entries-v1` ;
- `somatra-demo-clients-v1` ;
- `somatra-demo-open-preparations-v1`.

La normalisation doit être limitée aux entrées enregistrées : valeur exacte legacy **À contrôler** → **À valider** en mémoire. Elle ne déclenche aucun `setItem` dédié ; le stockage peut devenir canonique seulement lors d’une sauvegarde utilisateur ultérieure selon le flux existant. Le reset continue à retirer les trois clés puis recharge les seeds, désormais en **À valider**.

Les autres statuts historiques inconnus restent affichés comme texte échappé, sans être convertis en **À valider** ou **Validé**. À l’édition, une sélection invalide doit rester sans choix autorisé et la sauvegarde doit exiger explicitement **À valider** ou **Validé**.

Les statuts techniques des préparations ouvertes, `running` et `paused`, appartiennent à `somatra-demo-open-preparations-v1` et au chronométrage (`app.js:85-104,469-543`). Ils sont hors périmètre et ne doivent jamais passer par la normalisation des statuts métier.

## Impacts et limites

L’implémentation minimale concerne `app.js`, `index.html`, `AGENTS.md` et `README.md`. Aucun changement de styles, schéma, seed hors libellé, activité, commentaire, tarif, backend, dépendance ou appel réseau n’est requis.

La recherche d’occurrences finale doit tolérer **À contrôler** uniquement dans la règle explicite de compatibilité et sa documentation ; toutes les occurrences fonctionnelles doivent utiliser **À valider**. Les sorties PDF et CSV n’ont pas besoin d’une migration propre si elles consomment toutes la représentation normalisée des entrées.
