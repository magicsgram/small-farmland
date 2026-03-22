import type { GameDocument, GameSnapshot } from "@/lib/game/types";

export function toGameSnapshot(game: GameDocument): GameSnapshot {
  return {
    gameId: game.gameId,
    boardState: game.boardState,
    moveHistory: game.moveHistory.map((move) => ({
      ...move,
      createdAt: move.createdAt.toISOString(),
    })),
    status: game.status,
    suggestedColor: game.suggestedColor,
    showScoresAndLands: game.showScoresAndLands ?? true,
    farmland: game.farmland,
    lastActivityAt: game.lastActivityAt.toISOString(),
    lastActionAt: game.lastActionAt.toISOString(),
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}