# Brief — Prototype commercial Somatra

> Prototype de démonstration sur données entièrement fictives. Ce livrable n’est pas une application de production et ne doit pas être présenté comme tel.

## Contexte

Un magasinier prépare les commandes des clients finaux puis reporte manuellement, dans un fichier Excel, le temps consacré à chaque client. En fin de mois, ce fichier est transmis au service facturation pour établir les factures.

## Objectif commercial

Montrer à l’employeur comment une application simple pourrait :

1. enregistrer le temps de préparation par client et commande ;
2. centraliser les saisies ;
3. donner au service facturation une synthèse mensuelle ;
4. produire côté magasinier un relevé mensuel PDF non financier et simuler sa transmission ;
5. exporter les données de facturation sans ressaisie.

## Utilisateurs représentés

- **Magasinier** : démarre, arrête et corrige une saisie de temps.
- **Facturation** : consulte, filtre, contrôle et exporte les temps du mois.

## Parcours de démonstration

1. Connexion simulée.
2. Scan ou saisie d’une référence ; les références inconnues reçoivent automatiquement
   Client A, Client B, Client C, etc., de façon stable après rechargement.
3. Démarrage puis arrêt d’un chronomètre accéléré ou simulé.
4. Confirmation et éventuelle correction de la durée.
5. Filtrage du suivi, affichage et téléchargement d’un vrai relevé mensuel PDF sans donnée
   financière, puis simulation explicite de son envoi sans réseau.
6. Navigation vers la vue facturation.
7. Consultation d’une synthèse mensuelle et du détail d’un client.
8. Export CSV démontrable dans le navigateur.

## Écrans attendus

- Connexion / choix du profil de démonstration.
- Tableau de bord magasinier.
- Chronomètre et tâche en cours.
- Confirmation d’une saisie.
- Tableau de bord facturation.
- Détail mensuel d’un client.

## Données fictives

Utiliser uniquement des identités et références génériques : Client A, Client B, Client C, commandes `CMD-2026-0142`, etc. Les tarifs sont des exemples clairement signalés comme fictifs et restent absents de l’espace magasinier et de son PDF.

## Contraintes

- Prototype web statique, exécutable localement sans backend.
- Interface en français, responsive et mobile-first.
- Design logistique/industriel professionnel, lisible sur un quai.
- Gros boutons et cibles tactiles pour le magasinier.
- Navigation complète et crédible entre les vues.
- Aucun secret, aucune donnée réelle, aucun appel API.
- Génération PDF locale sans dépendance ; l’envoi est uniquement simulé, sans e-mail ni
  requête réseau.
- Éviter une fausse promesse : afficher discrètement « Démonstration — données fictives ».

## Hors périmètre

- Authentification réelle.
- Base de données et synchronisation serveur.
- Facturation réelle ou connexion comptable.
- Gestion exhaustive des rôles et règles tarifaires.
- Déploiement en production.

## Critères de validation

- Le parcours magasinier peut être démontré de bout en bout.
- Le temps enregistré apparaît dans la synthèse.
- Les vues magasinier et facturation sont distinctes.
- Le relevé PDF magasinier respecte le mois et les filtres actifs, s’affiche dans le
  navigateur, se télécharge et ne contient aucune donnée financière.
- La simulation d’envoi confirme explicitement qu’aucune transmission n’a eu lieu.
- Un export CSV fictif et fonctionnel est disponible.
- L’interface fonctionne en largeur mobile et desktop.
- Aucun message d’erreur JavaScript dans le parcours principal.
