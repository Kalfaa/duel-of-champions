# Duel of Champions

Jeu de cartes inspiré de *Might & Magic: Duel of Champions*, jouable contre une IA ou contre un autre joueur.

- `account-server/` : serveur de comptes (Node.js, fastify, `node:sqlite`). Il gère l'inscription et la connexion, délivre les jetons d'accès (JWT), et tient le classement Elo et les statistiques de jeu.
- `game-server/` : serveur de jeu (Node.js, fastify, ws). Il applique toutes les règles, fait jouer l'IA et apparie les joueurs. Il n'accepte que les joueurs connectés et envoie le résultat de chaque partie au serveur de comptes.
- `game-client/` : client web React (Vite). Il affiche l'état envoyé par le serveur et lui transmet les actions du joueur.
- `data/`, `img/cards/`, `tools/` : données et illustrations des cartes récupérées du wiki. `tools/scrape_set.py "<page du wiki>" <fichier.json>` récupère une extension (par défaut le Base set 1) ; `tools/make_art.py` génère les vignettes servies par le client (`game-client/public/img/`).

## Lancer en développement

Depuis la racine :

```sh
npm install     # installe aussi game-server et game-client
npm run dev     # comptes sur :3001, jeu sur :3000, client sur http://localhost:5173
```

Chaque projet peut aussi être lancé seul avec `npm run dev` dans son dossier.

## Comptes et classement

Il faut un compte pour jouer : le client affiche d'abord un écran de connexion / création de compte. Le pseudo fait de 3 à 20 caractères (lettres, chiffres, `_`, `-`) ; le mot de passe au moins 6 caractères (haché avec scrypt).

- Les parties contre un autre joueur sont classées (Elo, 1000 au départ, facteur K = 32) ; celles contre l'IA ne comptent que dans les statistiques.
- Un abandon ou une déconnexion en cours de partie compte comme une défaite.
- Deux connexions d'un même compte ne sont jamais appariées.
- Les comptes sont enregistrés dans `account-server/data/accounts.db` (variable `DATABASE_PATH` pour changer de fichier).

Les deux serveurs partagent deux secrets, lus dans les variables d'environnement ou dans le `.env` de la racine :

```sh
JWT_SECRET=<secret de signature des jetons d'accès>
INTERNAL_API_KEY=<clé que le serveur de jeu présente pour envoyer les résultats>
```

Sans eux, des valeurs de développement sont utilisées (avec un avertissement au démarrage) : **il faut les définir avant de partager le jeu**, sinon n'importe qui peut fabriquer un jeton ou un résultat de partie.

## Partager une partie sur Internet (ngrok)

Créer une fois un fichier `.env` à la racine (non versionné) avec son token ngrok, comme dans `.env.example` :

```sh
NGROK_AUTHTOKEN=<token ngrok>
JWT_SECRET=<secret aléatoire>
INTERNAL_API_KEY=<autre secret aléatoire>
```

(par exemple générés avec `openssl rand -hex 32`)

Puis :

```sh
npm run share
```

La commande construit le client, lance le serveur de comptes (port 3101), le serveur de jeu (port 3100) et le client en mode preview (port 4173), puis ouvre un tunnel ngrok et affiche l'URL publique à partager. Elle utilise ses propres ports, et peut donc tourner en même temps que `npm run dev`. Ctrl+C ferme le tout.

Au premier accès, ngrok affiche une page d'avertissement qu'il faut valider. Toute personne qui a l'URL peut créer un compte et jouer.

Le serveur Vite relaie `/api/accounts` vers le serveur de comptes (variable `ACCOUNT_SERVER_URL`, `http://localhost:3001` par défaut), le reste de `/api` et `/ws` vers le serveur de jeu (variable `GAME_SERVER_URL`, `http://localhost:3000` par défaut). Les routes internes du serveur de comptes (`/internal`) ne sont pas relayées.

## Tests

```sh
npm test && npm run typecheck   # depuis la racine, pour les trois projets
```

## Protocole

Serveur de comptes :

- `POST /api/accounts` `{ username, password }` : crée un compte et renvoie `{ token, account }`.
- `POST /api/accounts/login` `{ username, password }` : renvoie `{ token, account }`.
- `GET /api/accounts/me` (en-tête `Authorization: Bearer <token>`) : compte du joueur, avec son classement et ses statistiques.
- `GET /api/accounts/leaderboard?limit=20` : meilleurs joueurs classés.
- `POST /internal/matches` (en-tête `x-internal-key`) : résultat d'une partie, envoyé par le serveur de jeu. Un même résultat renvoyé n'est compté qu'une fois.

Serveur de jeu :

- HTTP `GET /api/decks` : decks jouables (un par héros), avec leur faction et leur héros.
- WebSocket `/ws?token=<jeton d'accès>` : sans jeton valide, la connexion est refermée avec le code 4401. Le client envoie `startAi` ou `findMatch` (avec le `deck` choisi), `action` ou `leave` ; le serveur répond par `waiting`, `state` (vue du joueur, avec la main adverse cachée et les coups légaux) ou `error`.
  Les types sont définis dans `game-server/src/route/protocol.ts` et `game-server/src/model/game-view.ts`, et reproduits côté client dans `game-client/src/api/protocol.ts`.
