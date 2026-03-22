import { NextResponse } from "next/server";

import { toGameSnapshot } from "@/lib/game/snapshot";
import { createGame } from "@/lib/games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ensure all responses include no-store cache control for dynamic content.
 */
function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export async function POST() {
  try {
    // Generate new game and return initial snapshot to client.
    const game = await createGame();

    return noStoreJson({
      gameId: game.gameId,
      snapshot: toGameSnapshot(game),
    });
  } catch (error) {
    // Failed to create game (likely ID generation failure or DB error).
    console.error(error);

    return noStoreJson(
      { error: "Failed to create a game." },
      { status: 500 },
    );
  }
}
