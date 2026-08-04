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

1. Choisir **Magasinier** et renseigner obligatoirement le nom du magasinier.
2. Sélectionner un client, puis choisir une commande existante, saisir une nouvelle référence manuellement ou utiliser le bouton **Scanner**.
3. Démarrer une préparation : son temps progresse selon l’horloge réelle et reste suivi après une actualisation.
4. Lancer éventuellement plusieurs commandes simultanément, puis mettre en pause, reprendre ou terminer chaque préparation indépendamment.
5. Corriger si besoin la durée et confirmer.
6. Ouvrir **Facturation** : la saisie apparaît dans la synthèse d’août 2026 avec le statut « À contrôler ».
7. Filtrer les résultats, ouvrir le détail d’un client ou télécharger l’export CSV.

Le scan natif de codes-barres et de QR codes est proposé uniquement si le navigateur prend en charge les API nécessaires et si une caméra compatible est disponible et autorisée. Dans le cas contraire, la référence de commande reste saisissable manuellement. Le flux vidéo est analysé localement dans le navigateur : aucune image n’est envoyée ni stockée.

Le nom du magasinier, les saisies, les préparations ouvertes et les clients/commandes ajoutés sont conservés localement dans le `localStorage` du navigateur. Chaque préparation en cours continue indépendamment selon son propre timestamp réel, y compris si la page est fermée. Démarrer, mettre en pause, reprendre ou terminer une commande ne modifie pas les autres. Aucun backend ni appel réseau n’est utilisé. Pour retrouver toutes les données initiales, supprimer les clés `somatra-demo-entries-v1`, `somatra-demo-clients-v1`, `somatra-demo-open-preparations-v1` et `somatra-demo-operator-v1` dans le stockage local du navigateur.

## Fichiers

- `index.html` : structure des vues et navigation.
- `styles.css` : interface responsive logistique/industrielle.
- `app.js` : suivi horaire persistant, saisies, filtres, synthèse, détail et export CSV.
- `BRIEF-PROTOTYPE.md` : cahier des charges fourni.
