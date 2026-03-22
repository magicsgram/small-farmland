import { NextResponse, type NextRequest } from "next/server";

import {
  applyGameAction,
  isGameIntegrityError,
  isGameRuleError,
} from "@/lib/game/engine";
import { isValidGameId, normalizeGameId } from "@/lib/game/id";
import { toGameSnapshot } from "@/lib/game/snapshot";
import type { GameActionInput } from "@/lib/game/types";
import { findGameById, saveGame } from "@/lib/games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Normalize cache control behavior: all responses must be dynamic.
 * Enables client always retrieves current game state.
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

/**
 * Normalize and validate game ID from path parameters.
 * Returns error response if ID is invalid or null.
 */
function validateGameId(rawGameId: string) {
  const gameId = normalizeGameId(rawGameId);
  if (!isValidGameId(gameId)) {
    return { gameId: null, response: noStoreJson({ error: "Invalid game ID." }, { status: 400 }) };
  }
  return { gameId, response: null };
}

/**
 * Translate game rule errors into client-safe responses.
 * Internal integrity errors are logged and downgraded to a generic public error.
 */
function handleGameRuleError(error: unknown) {
  if (isGameIntegrityError(error)) {
    console.error("Internal game integrity error", { reason: error.reason });

    return noStoreJson(
      {
        errorCode: "errors.connectionError",
      },
      { status: 500 },
    );
  }

  if (!isGameRuleError(error)) {
    return null;
  }

  return noStoreJson(
    {
      errorCode: error.errorCode,
    },
    { status: 409 },
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId: rawGameId } = await context.params;
  const { gameId, response } = validateGameId(rawGameId);

  if (response) return response;

  const game = await findGameById(gameId!);

  if (!game) {
    return noStoreJson({ errorCode: "errors.gameNotFound" }, { status: 404 });
  }

  return noStoreJson({ snapshot: toGameSnapshot(game) });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId: rawGameId } = await context.params;
  const { gameId, response } = validateGameId(rawGameId);

  if (response) return response;

  const game = await findGameById(gameId!);

  if (!game) {
    return noStoreJson({ errorCode: "errors.gameNotFound" }, { status: 404 });
  }

  // Parse request body. Validation happens in engine when action is applied.
  let action: GameActionInput;

  try {
    action = (await request.json()) as GameActionInput;
  } catch {
    return noStoreJson({ error: "Malformed request body." }, { status: 400 });
  }

  // Apply the action and persist the updated game state.
  try {
    const nextGame = applyGameAction(game, action);
    await saveGame(nextGame);

    return noStoreJson({ snapshot: toGameSnapshot(nextGame) });
  } catch (error) {
    // Attempt to map error to game rule error with i18n key for client.
    const ruleErrorResponse = handleGameRuleError(error);
    if (ruleErrorResponse) return ruleErrorResponse;

    // Unmapped error (server/system error): log and return generic error.
    console.error(error);
    return noStoreJson({ error: "Failed to update the game." }, { status: 500 });
  }
}