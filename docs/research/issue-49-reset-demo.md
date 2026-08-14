# Recherche — issue #49 : réinitialisation complète de la démo

**Version 1 — 2026-08-14**
**Ticket :** [#49 — Ajouter la réinitialisation complète de la démonstration](https://github.com/issa-diallo/somatra-prototype/issues/49)

## Besoin confirmé

Depuis le choix **Profil**, un bouton `Réinitialiser clients et données` ouvre un dialogue de confirmation, sans modifier le stockage. Le dialogue doit annoncer explicitement que l’action supprime les clients/références ajoutés, les préparations et chronomètres ouverts, les temps et modifications locales, puis restaure les données fictives initiales.

Seul `Tout réinitialiser` déclenche l’action. `Annuler`, la fermeture, Échap et un clic hors dialogue ne suppriment rien. Après succès des trois suppressions, la page est rechargée ; en cas d’échec, une erreur reste visible et aucun rechargement n’a lieu.

## État du code

- `index.html:23-42` porte l’écran initial `view-login`, ses deux cartes de profil et la notice de démonstration : c’est l’unique surface demandée pour le nouveau bouton.
- `index.html:182-212` contient déjà deux dialogues natifs `<dialog>` accessibles (scanner et PDF), avec titre référencé, description, fermeture et actions. Le reset peut reprendre ce modèle sans dépendance.
- `styles.css:3,6,14-15,19-20` impose déjà des contrôles d’au moins 48 px, les cartes Profil, le style des dialogues et les adaptations mobiles. Un style destructif rouge existe dans les variables, mais aucun composant de confirmation destructive n’est encore défini.
- `app.js:5-7` centralise exactement les trois clés ; `app.js:58-109` charge les seeds ou un état vide lorsque les clés sont absentes. `app.js:1176-1246` centralise les événements et montre le traitement de `cancel` des dialogues.
- L’initialisation `app.js:1249-1253` termine toujours sur `showView('login')`. Après suppression réussie et rechargement, `loadEntries()` reprend `seedEntries`, `loadClients()` reprend `seedOrders`, `loadOpenTasks()` retourne `[]`.
- La CI vérifie syntaxe, structure HTML et ressources HTTP, sans test fonctionnel ni navigateur.

## Contrat de stockage et résultat attendu

La liste de suppression doit réutiliser exclusivement les constantes existantes :

- `somatra-demo-entries-v1` ;
- `somatra-demo-clients-v1` ;
- `somatra-demo-open-preparations-v1`.

Chaque suppression doit appeler `localStorage.removeItem(key)`. `localStorage.clear()` est interdit, de même que toute suppression d’une clé étrangère. L’état applicatif en mémoire ne doit pas être vidé avant le succès : le rechargement est l’unique bascule vers l’état restauré.

Une fois les trois clés absentes puis la page rechargée, le comportement existant garantit : seeds restaurés, aucune préparation ouverte, retour au choix du profil et première nouvelle référence inconnue attribuée à **Client A**. Les commandes seed connues restent attribuées à leurs clients sans consommer cette séquence.

## Échec et cohérence

`removeItem` est synchrone mais peut lever une exception (stockage bloqué, politique navigateur ou doublure de test). Une erreur sur la deuxième ou troisième clé peut sinon laisser une suppression partielle. Le flux doit donc :

1. lire et mémoriser les trois valeurs avant toute suppression ;
2. tenter les trois `removeItem` sans toucher aux données en mémoire ;
3. considérer le reset réussi seulement si aucun appel n’échoue et si les trois clés sont absentes ;
4. en cas d’échec, restaurer au mieux les valeurs déjà retirées avec `setItem`, afficher une erreur persistante dans le dialogue et ne jamais recharger.

La restauration est une compensation d’échec, pas une autre méthode de suppression. Si elle échoue aussi, l’interface ne doit toujours annoncer aucun succès ; ce cas limite du stockage navigateur doit être signalé par un message invitant à recharger ou réessayer. Une clé étrangère de contrôle ne doit être ni lue pour mutation, ni écrite, ni supprimée.

## Accessibilité et responsive

- Utiliser un `<dialog>` modal avec titre et description reliés par `aria-labelledby`/`aria-describedby` ; détailler les quatre conséquences avant les actions.
- À l’ouverture, placer le focus sur `Annuler`, choix sûr ; conserver le piégeage natif, rendre la croix explicitement libellée et restituer le focus au bouton déclencheur à la fermeture.
- Intercepter `cancel` pour fermer sans effet. Si le clic sur le backdrop ferme le dialogue, il doit emprunter exactement le même chemin sans suppression.
- Exposer l’erreur avec `role="alert"`/annonce live, garder le dialogue ouvert et permettre une nouvelle tentative. Prévenir une double confirmation.
- Garder les actions à au moins 48 px, empiler si nécessaire à 320/390 px et éviter tout débordement horizontal ou vertical du dialogue.

## Périmètre

L’implémentation future touchera minimalement `index.html`, `styles.css`, `app.js` et `README.md`. Aucun backend, appel réseau, dépendance, nouvelle clé, changement de seed ou modification des flux activité, PDF, facturation, scan et chronométrage n’est requis.
