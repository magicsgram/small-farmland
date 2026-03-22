# Small Farmland Online

> **Disclaimer:** This project is **not affiliated with, endorsed by, or associated with [Korea Boardgames](https://www.koreaboardgames.com/) or [Lee Sedol](https://en.wikipedia.org/wiki/Lee_Sedol) in any way.** It is an independent, open-source project built solely for educational purposes. All proper nouns from the original game have been deliberately changed.

Small Farmland is an open-source implementation inspired by [**Great Kingdom**](https://boardgamegeek.com/boardgame/390607/great-kingdom), a board game designed by [Lee Sedol](https://en.wikipedia.org/wiki/Lee_Sedol) — the legendary South Korean Go professional (9 dan) known for his [2016 match against AlphaGo](https://en.wikipedia.org/wiki/AlphaGo_versus_Lee_Sedol). Great Kingdom is the first game in the [WIZSTONE](https://en.namu.wiki/w/%EC%9C%84%EC%A6%88%EC%8A%A4%ED%86%A4%20%EC%8B%9C%EB%A6%AC%EC%A6%88) series, published by [Korea Boardgames](https://www.koreaboardgames.com/) in 2023. It simplifies Go without losing what makes the game compelling, making it a perfect gateway into the world of Go.

---

The game is hosted at **[small-farmland.vercel.app](https://small-farmland.vercel.app/)** and can be played for free. This project is **not intended for commercial use**. Embedding this application in an iframe is **strictly forbidden**.

## License

This project is released under the [MIT License](LICENSE). The license covers the source code of this project only — it does not grant any rights to the original game's name, trademarks, artwork, or game design intellectual property.

---

## About This App

This Next.js app hosts a shareable multiplayer board game, with state persistence backed by MongoDB. Each new game gets a unique room ID, persists server-authoritative game state, and stays synchronized for connected players via server-sent events powered by MongoDB change streams.

## Environment Setup

Create `.env.local` from `.env.example` and fill in your values:

```bash
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_DB=small-farmland
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=<Your_tracking_id>

# Optional fallback if mongodb+srv DNS lookup fails locally
MONGODB_URI_DIRECT=mongodb://<username>:<password>@<host1>:27017,<host2>:27017,<host3>:27017/?ssl=true&replicaSet=<replicaSet>&authSource=admin&retryWrites=true&w=majority
```

MongoDB must run as a replica set because live updates use change streams.

## Run Locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## API

- `POST /api/games` creates a new multiplayer game room.
- `GET /api/games/[gameId]` returns the current serialized game snapshot for a room.
- `PATCH /api/games/[gameId]` applies a move, finish, undo, or reset action and returns the updated snapshot.
- `GET /api/games/[gameId]/events` streams the current and future snapshots for a room over SSE.
