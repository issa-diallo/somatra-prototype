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

1. Choisir **Magasinier**.
2. Sélectionner un client puis une commande.
3. Démarrer le chronomètre (accéléré 10×), attendre quelques secondes puis l’arrêter.
4. Corriger si besoin la durée et confirmer.
5. Ouvrir **Facturation** : la saisie apparaît dans la synthèse d’août 2026 avec le statut « À contrôler ».
6. Filtrer les résultats, ouvrir le détail d’un client ou télécharger l’export CSV.

Les saisies sont conservées dans le `localStorage` du navigateur, ainsi que les clients et commandes ajoutés pendant la démonstration. Aucun backend ni appel réseau n’est utilisé. Pour retrouver toutes les données initiales, supprimer les clés `somatra-demo-entries-v1` et `somatra-demo-clients-v1` dans le stockage local du navigateur.

## Fichiers

- `index.html` : structure des vues et navigation.
- `styles.css` : interface responsive logistique/industrielle.
- `app.js` : timer, saisies, filtres, synthèse, détail et export CSV.
- `BRIEF-PROTOTYPE.md` : cahier des charges fourni.
