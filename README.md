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
3. Démarrer une préparation : son temps progresse selon l’horloge réelle et reste suivi après une actualisation.
4. Lancez éventuellement une autre commande (la première est mise en pause), puis mettez en pause, reprenez ou terminez une préparation ouverte.
5. Corriger si besoin la durée et confirmer.
6. Ouvrir **Facturation** : la saisie apparaît dans la synthèse d’août 2026 avec le statut « À contrôler ».
7. Filtrer les résultats, ouvrir le détail d’un client ou télécharger l’export CSV.

Les saisies, les préparations ouvertes et les clients/commandes ajoutés sont conservés dans le `localStorage` du navigateur. Une préparation en cours continue selon les timestamps réels, y compris si la page est fermée. Aucun backend ni appel réseau n’est utilisé. Pour retrouver toutes les données initiales, supprimer les clés `somatra-demo-entries-v1`, `somatra-demo-clients-v1` et `somatra-demo-open-preparations-v1` dans le stockage local du navigateur.

## Fichiers

- `index.html` : structure des vues et navigation.
- `styles.css` : interface responsive logistique/industrielle.
- `app.js` : suivi horaire persistant, saisies, filtres, synthèse, détail et export CSV.
- `BRIEF-PROTOTYPE.md` : cahier des charges fourni.
