import { type Collection, MongoServerError } from "mongodb";

import { createNewGameDocument } from "@/lib/game/engine";
import { generateGameId, isValidGameId, normalizeGameId } from "@/lib/game/id";
import type { GameDocument } from "@/lib/game/types";
import { getDb } from "@/lib/mongodb";

const COLLECTION_NAME = "games";

let indexesReady: Promise<void> | null = null;
let ttlIndexRepairReady: Promise<void> | null = null;

async function getGamesCollection(): Promise<Collection<GameDocument>> {
  const database = await getDb();
  return database.collection<GameDocument>(COLLECTION_NAME);
}

async function ensureIndexes() {
  if (!indexesReady) {
    indexesReady = (async () => {
      const collection = await getGamesCollection();
      await collection.createIndex({ gameId: 1 }, { unique: true, name: "game_id_unique" });
    })();
  }

  await indexesReady;
}

function getTtlSeconds() {
  const ttlHours = Number.parseInt(process.env.GAME_TTL_HOURS ?? "2", 10);
  return Number.isNaN(ttlHours) ? 2 * 60 * 60 : ttlHours * 60 * 60;
}

async function ensureTtlIndexOnError() {
  if (!ttlIndexRepairReady) {
    ttlIndexRepairReady = (async () => {
      const collection = await getGamesCollection();
      const ttlSeconds = getTtlSeconds();

      try {
        await collection.createIndex(
          { lastActivityAt: 1 },
          { expireAfterSeconds: ttlSeconds, name: "games_last_activity_ttl" },
        );
      } catch (error) {
        const isTtlIndexConflict =
          error instanceof MongoServerError
          && (error.code === 85 || error.codeName === "IndexOptionsConflict");

        if (!isTtlIndexConflict) {
          throw error;
        }

        await collection.dropIndex("games_last_activity_ttl");
        await collection.createIndex(
          { lastActivityAt: 1 },
          { expireAfterSeconds: ttlSeconds, name: "games_last_activity_ttl" },
        );
      }
    })();
  }

  await ttlIndexRepairReady;
}

export async function findGameById(rawGameId: string) {
  const gameId = normalizeGameId(rawGameId);
  if (!isValidGameId(gameId)) {
    return null;
  }

  await ensureIndexes();
  const collection = await getGamesCollection();
  const game = await collection.findOne({ gameId }, { projection: { _id: 0 } });

  if (!game) {
    return null;
  }

  return {
    ...game,
    showScoresAndLands: game.showScoresAndLands ?? true,
  };
}

export async function createGame() {
  await ensureIndexes();
  const collection = await getGamesCollection();
  let ttlRepairAttempted = false;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const gameId = generateGameId();
    const document = createNewGameDocument(gameId);

    try {
      const { farmland: _unused, ...documentToInsert } = document;
      await collection.insertOne(documentToInsert);
      return document;
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        continue;
      }

      if (!ttlRepairAttempted && error instanceof MongoServerError) {
        ttlRepairAttempted = true;
        await ensureTtlIndexOnError();
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to generate a unique game ID.");
}

export async function saveGame(game: GameDocument) {
  await ensureIndexes();
  const collection = await getGamesCollection();

  await collection.updateOne(
    { gameId: game.gameId },
    {
      $set: {
        boardState: game.boardState,
        moveHistory: game.moveHistory,
        status: game.status,
        suggestedColor: game.suggestedColor,
        showScoresAndLands: game.showScoresAndLands ?? true,
        lastActivityAt: game.lastActivityAt,
        lastActionAt: game.lastActionAt,
        updatedAt: game.updatedAt,
      },
      $setOnInsert: {
        createdAt: game.createdAt,
      },
      $unset: {
        farmland: "",
        winner: "",
        consecutivePasses: "",
      },
    },
  );
}

export async function watchGameById(gameId: string) {
  await ensureIndexes();
  const collection = await getGamesCollection();

  return collection.watch(
    [
      {
        $match: {
          operationType: { $in: ["insert", "replace", "update"] },
          "fullDocument.gameId": gameId,
        },
      },
    ],
    {
      fullDocument: "updateLookup",
    },
  );
}
