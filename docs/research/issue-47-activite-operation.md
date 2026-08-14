# Recherche — issue #47 : activité d’une opération

**Version 1 — 2026-08-14**
**Ticket :** [#47 — Ajouter l’activité avant ou après le chronométrage](https://github.com/issa-diallo/somatra-prototype/issues/47)

## Besoin confirmé

L’opérateur choisit une activité soit avant le démarrage, soit à l’arrêt. L’enregistrement final exige une activité confirmée. Elle reste modifiable dans **Suivi** et apparaît dans **En cours**, **Suivi**, le PDF mensuel, le détail **Facturation** et le CSV. Le commentaire demeure facultatif et séparé.

Valeurs persistables autorisées :

- Préparation de commande ;
- Réception de marchandise ;
- Rangement ;
- Inventaire ;
- Retour d’événement ;
- Autre.

**Choisir après** est une option d’interface, représentée par une valeur vide et jamais persistée comme activité.

## État du code

- `index.html:57-72` contient le formulaire **Nouvelle** ; il ne saisit que la référence. `index.html:111-135` contient la confirmation (durée et commentaire). Le formulaire d’édition de **Suivi** est généré en JavaScript.
- `app.js:81-103` recharge les tâches ouvertes en reconstruisant explicitement leurs propriétés : `activity` devra y être conservée. `loadEntries` garde les propriétés additives des entrées.
- `app.js:468-498` crée et persiste une tâche ouverte ; `app.js:522-539` prépare la confirmation ; `app.js:573-602` crée l’entrée puis retire la tâche. C’est le chemin critique de validation.
- `app.js:545-563` rend **En cours**. `app.js:679-775` rend et enregistre l’édition **Suivi**. La liste compacte est rendue par lots de 20.
- `app.js:845-853` construit le détail Facturation ; `app.js:865-883` produit le CSV ; `app.js:946-1039` compose le PDF local. Le libellé PDF actuel `Activite/commentaire` désigne en réalité le seul commentaire et devra être séparé.
- `styles.css` est compact (styles regroupés) et porte les adaptations 320/390 px ainsi que les tableaux défilants.
- La CI ne fournit pas de tests fonctionnels : syntaxe JS, structure HTML et smoke HTTP seulement.

## Contrat de données et compatibilité

Les clés restent strictement inchangées :

- `somatra-demo-entries-v1` ;
- `somatra-demo-clients-v1` ;
- `somatra-demo-open-preparations-v1`.

Le changement de schéma est uniquement additif : `activity?: string` sur une tâche ouverte et une entrée. Une tâche démarrée avec **Choisir après** omet la propriété. Aucun chargement ne doit écrire le stockage uniquement pour combler ce champ.

Deux traitements sont distincts :

1. **Flux courant** : seule une valeur de la liste autorisée peut être persistée ; la confirmation refuse la valeur vide ou forgée.
2. **Lecture historique** : champ absent → `Non renseignée` ; chaîne inconnue → affichage textuel échappé, sans l’insérer comme HTML ni la considérer comme une option valide lors d’une prochaine édition/confirmation.

Il faut donc centraliser la liste autorisée, la validation et le libellé d’affichage. Pour les tâches ouvertes, le chargeur doit recopier la propriété existante sans déclencher de persistance ; sinon une valeur historique inconnue disparaîtrait dès le rechargement en mémoire.

## Impacts et points de vigilance

- Chaque tâche porte sa propre activité : aucune variable globale de formulaire ne doit coupler deux chronomètres.
- À l’arrêt, une activité autorisée est préremplie ; absence ou valeur historique inconnue laisse la sélection obligatoire vide. Annuler la confirmation conserve la tâche en pause, comme aujourd’hui.
- **Suivi** doit afficher le libellé dans la ligne et dans son nom accessible, puis proposer un `select` obligatoire en édition. Une ancienne entrée reste consultable sans réécriture ; sa sauvegarde exige une valeur autorisée.
- Le PDF doit produire des lignes distinctes `Activite : …` et, si présent, `Commentaire : …`, avec les protections PDF existantes et sans donnée financière.
- Le détail Facturation gagne une colonne **Activité** ; prévoir le nouveau `colspan` vide. Le CSV gagne une colonne **Activité**, sans changer ses filtres ni son calcul fictif.
- La densité de **Suivi**, le tableau Facturation et les sélecteurs doivent rester utilisables sans débordement global à 320, 390 px et desktop.
- Les seeds peuvent rester sans champ afin de couvrir naturellement le rendu legacy `Non renseignée`; aucune migration destructive n’est nécessaire.

## Périmètre documentaire futur

L’implémentation devra mettre à jour `README.md` pour décrire le choix, la confirmation obligatoire, les surfaces d’affichage et la propriété additive compatible. Aucun backend, référentiel, tarif par activité, appel réseau ou nouvelle dépendance n’est requis.
