# AGENTS.md — Guide opérationnel Somatra

## 1. Mission

Prototype web statique de démonstration du suivi des temps de préparation logistique et
de leur consolidation mensuelle fictive.

- Utiliser uniquement des données synthétiques et génériques.
- Ne jamais présenter le prototype comme une application de production.
- Préserver l’exécution sans backend, API, base partagée ni authentification réelle.
- La persistance reste locale au navigateur via `localStorage`.

## 2. Sources de vérité

Lire, dans l’ordre :

1. `AGENTS.md` : règles et invariants ;
2. `README.md` : état fonctionnel, lancement, stockage et limites ;
3. `COMMITS.md` : workflow Git ;
4. le code concerné et `.github/workflows/ci-pages.yml` : comportement et CI ;
5. `BRIEF-PROTOTYPE.md` : intention initiale, non exhaustive.

Le code et le README actuels prévalent sur le brief, mais jamais sur ce guide, la
sécurité ou le ticket. Si le code contredit un invariant d’`AGENTS.md`, ne pas le
supposer correct : résoudre la divergence ou arrêter et demander une validation
humaine.

## 3. Cartographie

- `index.html` : vues, formulaires, dialogues et navigation.
- `styles.css` : présentation responsive, tactile et états visuels.
- `app.js` : état, seeds, stockage, chronomètres, scan, filtres, édition, facturation et
  CSV.
- `assets/` : ressources statiques, dont `somatra-logo.jpg`.
- `.github/workflows/ci-pages.yml` : validation et publication GitHub Pages.
- `README.md`, `COMMITS.md`, `BRIEF-PROTOTYPE.md` : documentation.

## 4. Invariants fonctionnels

### Identité, référence et scan

- L’identité des nouveaux enregistrements est **Magasinier démo**.
- Une référence normalisée doit être non vide et compter au plus 120 caractères. Elle
  reste libre, sans résolution ni validation backend.
- Le scan remplit seulement la référence ; le démarrage reste une action explicite.
- La saisie manuelle reste le repli principal et l’accès caméra exige une action.
- Arrêter flux et pistes caméra après lecture, annulation, fermeture ou erreur.
- Analyser localement ; ne transmettre ni stocker aucune image.

### Préparations et chronomètres

- Autoriser plusieurs préparations simultanées et indépendantes, sans pause automatique.
- Conserver pour chacune état, durée cumulée et timestamps ; aucune action sur l’une ne
  doit modifier les autres.
- Persister les préparations ouvertes et leur chronométrage entre chargements.
- La fin ouvre une confirmation permettant de corriger la durée avant enregistrement.

### Espace Magasinier

- Conserver **Nouvelle**, **En cours**, **Suivi** et **Profil**.
- N’y afficher aucun prix, CHF, tarif, export ni élément de facturation.
- Garder le suivi compact, tactile et viable avec au moins 50 lignes : 20 initiales,
  chargées ensuite par lots de 20.
- Sur mobile, les filtres restent repliables et réinitialisables.
- Calculer les KPI sur tous les résultats filtrés, pas seulement les lignes rendues.
- Une ligne ouvre l’édition du client/commande, de la référence, date, durée et statut.
- Limiter les statuts éditables à **À contrôler** et **Validé**.

### Espace Facturation

- Maintenir une interface distincte avec filtres, synthèse, détail client et CSV filtré.
- Signaler explicitement les montants CHF et tarifs comme fictifs.
- La séparation des profils simule une interface, pas une authentification ni un contrôle
  d’accès.

### Client inconnu et compatibilité

- Pour une référence libre nouvelle, employer la référence comme libellé client/commande.
- Conserver la migration legacy de `Client à identifier` vers ce libellé pour les entrées
  et préparations ouvertes existantes. Ne la retirer qu’avec une stratégie explicite de
  compatibilité ou migration et une validation humaine.
- Conserver exactement ces clés `localStorage` :
  - `somatra-demo-entries-v1` ;
  - `somatra-demo-clients-v1` ;
  - `somatra-demo-open-preparations-v1`.
- La clé clients peut être lue sans être écrite dans le flux courant.
- Ne pas renommer, supprimer, vider ou migrer ces clés ni changer leur schéma sans
  stratégie explicite de compatibilité et validation humaine.

## 5. Interface

- Interfaces et messages utilisateur en français.
- Concevoir mobile-first ; vérifier 320 px, 390 px et desktop, sans débordement horizontal.
- Maintenir les cibles tactiles principales à au moins 48 px.
- Pour 50 lignes ou plus, préférer une liste dense et lisible aux grandes cartes.
- Garder le logo seul dans la marque d’en-tête et une navigation principale cohérente par
  contexte et largeur.
- Préserver focus visibles, libellés accessibles, ARIA et annonces utiles.
- Vérifier les états vide, chargement et erreur lorsqu’ils existent.
- Ne pas perdre un brouillon d’édition lors d’un re-rendu ou changement sans rapport.

## 6. Sécurité et technique

- Ne saisir, copier, générer ni committer aucune donnée personnelle ou métier réelle.
- N’ajouter aucun secret, jeton, identifiant sensible ou `.env` ; ne pas lire les secrets
  du poste ou du dépôt pour ce prototype.
- Sans demande explicite et décision documentée, n’ajouter ni backend, API, dépendance,
  analytics ni ressource réseau externe.
- Aucun envoi caméra, upload, télémétrie ou stockage d’image.
- Ne pas suggérer une disponibilité en production ; distinguer estimation de démo, tarif
  fictif et facturation réelle.

## 7. Git

Appliquer `COMMITS.md` :

1. partir d’un `main` propre et à jour (`git pull --ff-only origin main`) ;
2. travailler depuis une issue sur `<type>/<numero-ticket>-<description>` ;
3. respecter **1 ticket = 1 branche = 1 commit = 1 PR** ;
4. ne jamais développer, pousser directement ni forcer un push sur `main` ;
5. utiliser Conventional Commits et finir le corps par `Refs: #<ticket>` ;
6. documenter dans la PR résumé, changements, validations réelles, limites et
   `Fixes #<ticket>` si le ticket est entièrement traité ;
7. attendre toute la CI avant squash merge, puis supprimer la branche distante.

Pour de la documentation seule, un budget de taille peut être non bloquant si la CI le
prévoit ; qualité, syntaxe, sécurité et intégrité restent bloquantes.

## 8. Méthode et validation

Avant de modifier : lire les sources, confirmer branche et état Git, identifier vues,
événements, données et clés touchés, puis faire le changement minimal. Préserver le
`localStorage`. Vérifier les deux profils si la surface ou le contrat est partagé ou si
une fuite est possible. Ne pas altérer arbitrairement seeds, dates, snapshots ou fixtures
pour réussir un test. À la fin, seuls les fichiers du ticket doivent être modifiés.

Adapter les validations à la portée réelle et les lancer depuis la racine.

### Socle

```bash
git diff --check
git status --short
git diff --cached --check
git status --short
```

### Documentation seule

Vérifier chaque Markdown modifié en le nommant explicitement :

```bash
npx --yes prettier@3.8.4 --check AGENTS.md
```

Cette commande épinglée exige Node.js, npm et, si la version n’est pas en cache, le
réseau. Signaler honnêtement toute indisponibilité. Relire liens et commandes modifiés.
Un changement documentation seul n’exige ni `node --check`, ni smoke HTTP, ni navigateur,
ni vérification des deux profils.

### Code, HTML, CSS, assets ou workflow

- Lancer `node --check app.js` si JavaScript est touché ou si le contrôle est peu coûteux.
- Exécuter les tests ciblés des comportements modifiés.
- Pour l’application ou ses assets, lancer ce smoke HTTP autonome :

```bash
python3 - <<'PY'
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from urllib.request import urlopen


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    host, port = server.server_address
    for path in ("/index.html", "/app.js", "/styles.css", "/assets/somatra-logo.jpg"):
        with urlopen(f"http://{host}:{port}{path}", timeout=5) as response:
            assert response.status == 200, (path, response.status)
finally:
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)
PY
```

### Interface interactive

Tester dans un vrai navigateur les vues, interactions et rôles concernés :

- desktop et 390 px ; ajouter 320 px pour densité, filtres, tableaux ou navigation ;
- console JavaScript, clavier, focus, ARIA, débordements et états concernés ;
- les deux profils seulement si surface/contrat partagé ou risque de fuite financière ;
- survie du brouillon aux re-rendus prévus.

Scénarios selon l’impact :

- **Suivi 50+** : injecter temporairement 55 entrées synthétiques ; vérifier 20 → 40 → 55,
  filtres/reset, KPI globaux et édition (ouverture, enregistrement, annulation).
- **Chronomètres** : en lancer deux ; pauser, reprendre et finir l’un sans toucher l’autre ;
  recharger et vérifier états et durées.
- **Scan** : action explicite, remplissage sans démarrage et repli manuel ; ne pas annoncer
  un test caméra sans appareil et permission réels.
- **Facturation** : si touchés, vérifier filtres, détail, montant fictif et CSV.

Restaurer les données locales après les seeds. Ne déclarer que les tests réellement faits
et signaler ceux impossibles.

## 9. CI et GitHub Pages

- Une PR vers `main` valide sans publier ; seul un `push` sur `main` déclenche Pages.
- Après merge, prendre le SHA distant exact et uniquement le run dont `headSha` est égal :

  ```bash
  git fetch origin main
  sha=$(git rev-parse origin/main)
  run_id=$(gh run list --workflow ci-pages.yml --branch main \
    --json databaseId,headSha --limit 20 \
    --jq "map(select(.headSha == \"$sha\"))[0].databaseId")
  test -n "$run_id"
  gh run watch "$run_id" --exit-status
  ```

  Ne jamais utiliser un run plus ancien si aucun ne correspond.

- Avec `pages_url=https://issa-diallo.github.io/somatra-prototype`, vérifier les versions :

  ```bash
  index=$(curl --fail --silent --show-error "$pages_url/")
  grep -F "app.js?v=$sha" <<<"$index"
  grep -F "styles.css?v=$sha" <<<"$index"
  ```

- Si code ou style change, comparer les hashes servis et attendus pour `app.js`, puis
  `styles.css` :

  ```bash
  curl --fail --silent --show-error "$pages_url/app.js?v=$sha" | sha256sum
  git show "$sha:app.js" | sha256sum
  ```

  Ouvrir l’URL publique et contrôler la console. Pour README seul, un hash raw peut
  suffire pour le contenu, mais ne remplace pas la vérification du bon run.

## 10. Escalade obligatoire

Demander une validation humaine avant : backend/API réelle, persistance partagée,
synchronisation serveur, authentification/autorisation réelle, données réelles ou PII,
référentiel métier, tarif contractuel/facturation réelle/comptabilité, migration
incompatible du `localStorage`, dépendance structurante/service externe, transmission ou
stockage d’images caméra, architecture ou annonce de production.

## 11. Definition of Done

- [ ] Ticket satisfait par un changement minimal, sans fonctionnalité inventée.
- [ ] Invariants concernés, séparation des profils et contrat `localStorage` préservés.
- [ ] Interface touchée : française, tactile, accessible et sans overflow aux largeurs
      visées ; parcours/rôles impactés testés selon le risque.
- [ ] `node --check app.js` réussit si JavaScript est concerné ou le contrôle peu coûteux.
- [ ] Pour chaque Markdown touché, Prettier épinglé réussit ou son indisponibilité est
      signalée.
- [ ] Pour l’application ou ses assets, le smoke HTTP des quatre ressources réussit.
- [ ] Tests ciblés concernés réussis.
- [ ] `git diff --check`, `git diff --cached --check` et `git status --short` confirment un
      périmètre propre.
- [ ] CI complète verte avant merge ; tout déploiement attendu est lié au SHA exact.
