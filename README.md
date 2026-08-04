# Somatra — prototype commercial

[Consulter le prototype en ligne](https://issa-diallo.github.io/somatra-prototype/)

Prototype web statique, mobile-first et sans dépendance, réalisé uniquement avec des données fictives.

> **Important :** il s’agit d’une démonstration commerciale, sans authentification réelle, backend, facturation réelle ni données client.

## Lancer localement

Depuis ce dossier :

```bash
python3 -m http.server 8080
```

Puis ouvrir <http://localhost:8080>.

## Parcours conseillé

1. Choisir **Magasinier**. L’authentification est simulée par l’opérateur en lecture seule **Magasinier démo**, automatiquement associé à toute nouvelle préparation. Le menu magasinier s’ouvre sur **Nouvelle**.
2. Dans **Nouvelle**, scanner une commande ou saisir sa référence manuellement. Toute référence non vide de 120 caractères maximum peut être démarrée, sans recherche préalable de client. Le scan remplit uniquement le champ : le démarrage reste une action manuelle.
3. Démarrer une préparation : l’interface passe sur **En cours**, où son temps progresse selon l’horloge réelle et reste suivi après une actualisation.
4. Lancer éventuellement plusieurs commandes simultanément, puis les mettre en pause, reprendre ou terminer indépendamment depuis **En cours**.
5. Corriger si besoin la durée et confirmer : l’interface passe sur **Historique** pour afficher la saisie enregistrée.
6. Ouvrir **Facturation** : la saisie apparaît dans la synthèse d’août 2026 avec le statut « À contrôler ».
7. Filtrer les résultats, ouvrir le détail d’un client ou télécharger l’export CSV.

Le scan natif de codes-barres et de QR codes est proposé uniquement si le navigateur prend en charge les API nécessaires et si une caméra compatible est disponible et autorisée. Dans le cas contraire, la référence de commande reste saisissable manuellement. Le flux vidéo est analysé localement dans le navigateur : aucune image n’est envoyée ni stockée.

Les saisies, les préparations ouvertes et les commandes fictives déjà enregistrées sont conservées localement dans le `localStorage` du navigateur. Lorsqu’une nouvelle préparation n’a pas de client correspondant, sa référence de commande normalisée sert de libellé de regroupement dans l’historique, la facturation et le CSV. Les anciennes préparations enregistrées avec le libellé exact « Client à identifier » sont automatiquement mises à jour de la même manière si leur référence est valide ; les clients fictifs et les autres libellés existants restent inchangés. Chaque préparation en cours continue indépendamment selon son propre timestamp réel, y compris si la page est fermée. Démarrer, mettre en pause, reprendre ou terminer une commande ne modifie pas les autres. Aucun backend ni appel réseau n’est utilisé. Pour retrouver toutes les données initiales, supprimer les clés `somatra-demo-entries-v1`, `somatra-demo-clients-v1` et `somatra-demo-open-preparations-v1` dans le stockage local du navigateur. L’ancienne clé `somatra-demo-operator-v1` peut également être supprimée lors d’un reset complet, mais elle n’est plus lue ni écrite.

## Fichiers

- `index.html` : structure des vues et navigation.
- `styles.css` : interface responsive logistique/industrielle.
- `app.js` : suivi horaire persistant, saisies, filtres, synthèse, détail et export CSV.
- `BRIEF-PROTOTYPE.md` : cahier des charges fourni.
