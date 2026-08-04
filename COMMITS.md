# COMMITS.md — Règles Git Somatra

## Workflow obligatoire

- **1 ticket GitHub = 1 branche = 1 commit = 1 pull request.**
- Toujours partir d’un `main` propre et à jour :

```bash
git checkout main
git pull --ff-only origin main
git checkout -b <type>/<numero-ticket>-<description>
```

- Ne jamais développer directement sur `main`.
- Ne jamais forcer un push sur `main`.
- Attendre la réussite complète de la CI avant le merge.
- Utiliser un squash merge et supprimer la branche distante après fusion.

## Nommage des branches

- `feat/<ticket>-<description>` : fonctionnalité
- `fix/<ticket>-<description>` : correction
- `docs/<ticket>-<description>` : documentation
- `ci/<ticket>-<description>` : intégration ou déploiement
- `refactor/<ticket>-<description>` : restructuration sans changement fonctionnel

Exemple :

```text
feat/12-export-mensuel
```

## Format du commit

Utiliser Conventional Commits :

```text
<type>(<scope>): <résumé court>

Refs: #<ticket>
```

Types autorisés : `feat`, `fix`, `docs`, `ci`, `refactor`, `test`, `chore`.

Exemple :

```text
feat(timer): ajouter la confirmation du temps

Refs: #12
```

## Avant le commit

- Vérifier que seuls les fichiers du ticket sont modifiés.
- Vérifier qu’aucune donnée réelle, aucun secret et aucun fichier `.env` n’est suivi.
- Exécuter les validations indiquées dans `AGENTS.md`.
- Contrôler :

```bash
git diff --check
git status --short
```

## Pull request

La PR doit contenir :

- un résumé du besoin ;
- la liste des changements ;
- les validations réellement exécutées ;
- les limites ou hypothèses de démonstration ;
- `Fixes #<ticket>` si le ticket est entièrement traité.

Une PR contenant plusieurs commits doit être corrigée avant merge, sauf validation humaine explicite.
