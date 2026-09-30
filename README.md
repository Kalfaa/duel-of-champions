# Duel of Champions

Jeu de cartes inspiré de *Might & Magic: Duel of Champions*, jouable contre une IA ou contre un autre joueur.

- `game-server/` : serveur de jeu (Node.js, fastify, ws). Il applique toutes les règles, fait jouer l'IA et apparie les joueurs.
- `game-client/` : client web React (Vite). Il affiche l'état envoyé par le serveur et lui transmet les actions du joueur.
- `data/`, `img/cards/`, `tools/` : données et illustrations des cartes récupérées du wiki. `tools/make_art.py` génère les vignettes servies par le client (`game-client/public/img/`).

## Lancer en développement

Depuis la racine :

```sh
npm install     # installe aussi game-server et game-client
npm run dev     # serveur sur http://localhost:3000, client sur http://localhost:5173
```

Chaque projet peut aussi être lancé seul avec `npm run dev` dans son dossier.

## Partager une partie sur Internet (ngrok)

Créer une fois un fichier `.env` à la racine (non versionné) avec son token ngrok, comme dans `.env.example` :

```sh
NGROK_AUTHTOKEN=<token ngrok>
```

Puis :

```sh
npm run share
```

La commande construit le client, lance le serveur de jeu (port 3100) et le client en mode preview (port 4173), puis ouvre un tunnel ngrok et affiche l'URL publique à partager. Elle utilise ses propres ports, et peut donc tourner en même temps que `npm run dev`. Ctrl+C ferme le tout.

Au premier accès, ngrok affiche une page d'avertissement qu'il faut valider. Le serveur de jeu n'a pas d'authentification : toute personne qui a l'URL peut jouer.

Le serveur Vite relaie `/api` et `/ws` vers le serveur de jeu (variable `GAME_SERVER_URL` pour changer l'adresse, `http://localhost:3000` par défaut).

## Tests

```sh
npm test && npm run typecheck   # depuis la racine, pour les deux projets
```

## Protocole

- HTTP `GET /api/factions` : factions jouables.
- WebSocket `/ws` : le client envoie `startAi`, `findMatch`, `action` ou `leave` ; le serveur répond par `waiting`, `state` (vue du joueur, avec la main adverse cachée et les coups légaux) ou `error`.
  Les types sont définis dans `game-server/src/route/protocol.ts` et `game-server/src/model/game-view.ts`, et reproduits côté client dans `game-client/src/api/protocol.ts`.
