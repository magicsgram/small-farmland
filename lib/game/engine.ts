import {
  BOARD_SIZE,
  CENTER_INDEX,
  type BoardPosition,
  type GameActionInput,
  type GameDocument,
  type MoveEvent,
  type PieceState,
  type PlayerColor,
  type FarmlandSummary,
} from "@/lib/game/types";

import {
  InternalGameIntegrityReason,
  type PublicGameRuleErrorCode,
  PUBLIC_GAME_RULE_ERROR_CODES,
  makeTurnErrorCode,
} from "@/lib/game/errors";
const DIRECTIONS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const NEUTRAL_PLACEMENT_NOTE = "placed neutral farmhouse";

class GameRuleError extends Error {
  constructor(public readonly errorCode: PublicGameRuleErrorCode) {
    super(errorCode);
    this.name = "GameRuleError";
  }
}

class GameIntegrityError extends Error {
  constructor(public readonly reason: InternalGameIntegrityReason) {
    super("Game integrity error");
    this.name = "GameIntegrityError";
  }
}

function cloneBoard(boardState: PieceState[][]) {
  return boardState.map((row) => [...row]);
}

function isInBounds(row: number, col: number) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function otherColor(color: PlayerColor): PlayerColor {
  return color === "blue" ? "orange" : "blue";
}

function positionKey(position: BoardPosition) {
  return `${position.row}:${position.col}`;
}

function getNeighbors(position: BoardPosition) {
  return DIRECTIONS.map(({ row, col }) => ({
    row: position.row + row,
    col: position.col + col,
  })).filter(({ row, col }) => isInBounds(row, col));
}

/**
 * Find a connected component (group) of pieces matching a color via BFS.
 * Used to check liberties and detect captures during move validation.
 */
function getGroup(boardState: PieceState[][], start: BoardPosition, color: PlayerColor) {
  const queue = [start];
  const visited = new Set<string>([positionKey(start)]);
  const group: BoardPosition[] = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    group.push(current);

    for (const neighbor of getNeighbors(current)) {
      if (visited.has(positionKey(neighbor))) {
        continue;
      }

      if (boardState[neighbor.row][neighbor.col] !== color) {
        continue;
      }

      visited.add(positionKey(neighbor));
      queue.push(neighbor);
    }
  }

  return group;
}

/**
 * Count empty adjacent cells (liberties) for a group of pieces.
 * A piece/group with zero liberties is captured (removed from board).
 * Liberties are deduplicated across the group.
 */
function countLiberties(boardState: PieceState[][], group: BoardPosition[]) {
  const liberties = new Set<string>();

  for (const position of group) {
    for (const neighbor of getNeighbors(position)) {
      if (boardState[neighbor.row][neighbor.col] === null) {
        liberties.add(positionKey(neighbor));
      }
    }
  }

  return liberties.size;
}

/**
 * Detect opponent pieces/groups that should be captured after a move.
 * Iterates adjacent opponents and checks if any group (connected component) has zero liberties.
 * Returns all pieces in captured groups.
 */
function findCapturedPieces(
  boardState: PieceState[][],
  placedAt: BoardPosition,
  color: PlayerColor,
) {
  const opponent = otherColor(color);
  const visited = new Set<string>();
  const captured: BoardPosition[] = [];

  for (const neighbor of getNeighbors(placedAt)) {
    if (boardState[neighbor.row][neighbor.col] !== opponent) {
      continue;
    }

    const key = positionKey(neighbor);
    if (visited.has(key)) {
      continue;
    }

    const group = getGroup(boardState, neighbor, opponent);

    for (const position of group) {
      visited.add(positionKey(position));
    }

    if (countLiberties(boardState, group) === 0) {
      captured.push(...group);
    }
  }

  return captured;
}

/**
 * Collect claimed farmland owned by each player.
 * 
 * Algorithm: Flood-fill from each empty cell, building a region of connected empty cells.
 * A region is owned territory if:
 *   - It does NOT touch all 4 board edges (neutral zones touch edges)
 *   - It is bordered by only one player's pieces (mixed borders → neutral)
 * 
 * Returns a map of owned cells keyed by color (e.g., {"blue": Set<"row:col">, "orange": ...})
 */
function collectTerritories(boardState: PieceState[][]) {
  const visited = new Set<string>();
  const ownedCells = {
    blue: new Set<string>(),
    orange: new Set<string>(),
  };

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (boardState[row][col] !== null) {
        continue;
      }

      const startKey = `${row}:${col}`;
      if (visited.has(startKey)) {
        continue;
      }

      const queue: BoardPosition[] = [{ row, col }];
      const region: BoardPosition[] = [];
      const borderColors = new Set<PlayerColor | "neutral">();
      const touchedBoardSides = new Set<"top" | "right" | "bottom" | "left">();

      visited.add(startKey);

      while (queue.length > 0) {
        const current = queue.shift();

        if (!current) {
          continue;
        }

        region.push(current);

        if (
          current.row === 0
        ) {
          touchedBoardSides.add("top");
        }

        if (current.row === BOARD_SIZE - 1) {
          touchedBoardSides.add("bottom");
        }

        if (current.col === 0) {
          touchedBoardSides.add("left");
        }

        if (current.col === BOARD_SIZE - 1) {
          touchedBoardSides.add("right");
        }

        for (const neighbor of getNeighbors(current)) {
          const neighborValue = boardState[neighbor.row][neighbor.col];

          if (neighborValue === null) {
            const neighborKey = positionKey(neighbor);
            if (!visited.has(neighborKey)) {
              visited.add(neighborKey);
              queue.push(neighbor);
            }
            continue;
          }

          borderColors.add(neighborValue);
        }
      }

      if (touchedBoardSides.size === 4) {
        continue;
      }

      const ownerCandidates = ["blue", "orange"].filter((color) =>
        borderColors.has(color as PlayerColor),
      ) as PlayerColor[];

      if (ownerCandidates.length !== 1) {
        continue;
      }

      const owner = ownerCandidates[0];

      for (const position of region) {
        ownedCells[owner].add(positionKey(position));
      }
    }
  }

  return ownedCells;
}

function farmlandSummary(boardState: PieceState[][]): FarmlandSummary {
  const territories = collectTerritories(boardState);

  return {
    blue: territories.blue.size,
    orange: territories.orange.size,
  };
}

function hasNeutral(boardState: PieceState[][]) {
  return boardState.some((row) => row.includes("neutral"));
}

function createLegacyCenterNeutralBoard() {
  const boardState = createInitialBoard();
  boardState[CENTER_INDEX][CENTER_INDEX] = "neutral";
  return boardState;
}

function isNeutralPlacementMove(move: MoveEvent) {
  return move.type === "place" && move.note === NEUTRAL_PLACEMENT_NOTE;
}

function getReplayInitialBoard(game: GameDocument) {
  const hasRecordedNeutralPlacement = game.moveHistory.some((move) => isNeutralPlacementMove(move));

  if (hasRecordedNeutralPlacement) {
    return createInitialBoard();
  }

  const centerHasNeutral = game.boardState[CENTER_INDEX][CENTER_INDEX] === "neutral";
  const neutralCount = game.boardState.flat().filter((value) => value === "neutral").length;

  if (centerHasNeutral && neutralCount === 1) {
    return createLegacyCenterNeutralBoard();
  }

  return createInitialBoard();
}

function canPlaceOnBoard(
  boardState: PieceState[][],
  color: PlayerColor,
  row: number,
  col: number,
  territories: ReturnType<typeof collectTerritories>,
) {
  if (!isInBounds(row, col)) {
    return false;
  }

  if (boardState[row][col] !== null) {
    return false;
  }

  const targetPosition = `${row}:${col}`;

  if (territories.blue.has(targetPosition) || territories.orange.has(targetPosition)) {
    return false;
  }

  const nextBoardState = cloneBoard(boardState);
  nextBoardState[row][col] = color;

  const captured = findCapturedPieces(nextBoardState, { row, col }, color);
  for (const position of captured) {
    nextBoardState[position.row][position.col] = null;
  }

  const placedGroup = getGroup(nextBoardState, { row, col }, color);
  return countLiberties(nextBoardState, placedGroup) > 0;
}

function hasAnyLegalMove(boardState: PieceState[][]) {
  const territories = collectTerritories(boardState);

  for (const color of ["blue", "orange"] as const) {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (canPlaceOnBoard(boardState, color, row, col, territories)) {
          return true;
        }
      }
    }
  }

  return false;
}

function getPlacementOutcome(
  boardState: PieceState[][],
  capturedCount: number,
) {
  const farmland = farmlandSummary(boardState);

  if (capturedCount > 0) {
    return {
      status: "finished" as const,
      farmland,
    };
  }

  if (!hasAnyLegalMove(boardState)) {
    return {
      status: "finished" as const,
      farmland,
    };
  }

  return {
    status: "active" as const,
    farmland,
  };
}

function appendMove(game: GameDocument, move: MoveEvent) {
  return [...game.moveHistory, move];
}

function createBaseGameState(game: GameDocument): GameDocument {
  const boardState = getReplayInitialBoard(game);

  return {
    gameId: game.gameId,
    boardState,
    moveHistory: [],
    status: "active",
    suggestedColor: "blue",
    farmland: farmlandSummary(boardState),
    lastActivityAt: game.createdAt,
    lastActionAt: game.createdAt,
    createdAt: game.createdAt,
    updatedAt: game.createdAt,
  };
}

function shouldFinishAfterPass(moveHistory: MoveEvent[]) {
  if (moveHistory.length === 0) {
    return false;
  }

  return moveHistory[moveHistory.length - 1]?.type === "pass";
}

function actionFromMove(move: MoveEvent): GameActionInput {
  if (move.type === "place") {
    if (!move.actorColor || !move.position) {
      throw new GameIntegrityError(InternalGameIntegrityReason.MoveDataIncomplete);
    }

    return {
      type: "place",
      color: move.actorColor,
      row: move.position.row,
      col: move.position.col,
    };
  }

  if (move.type === "pass") {
    if (!move.actorColor) {
      throw new GameIntegrityError(InternalGameIntegrityReason.PassDataIncomplete);
    }

    return {
      type: "pass",
      color: move.actorColor,
    };
  }

  if (move.type === "finish") {
    return {
      type: "finish",
    };
  }

  return { type: "reset" };
}

function applyRecordedMove(game: GameDocument, move: MoveEvent): GameDocument {
  if (move.type === "place") {
    if (!move.position) {
      throw new GameIntegrityError(InternalGameIntegrityReason.MoveDataIncomplete);
    }

    const boardState = cloneBoard(game.boardState);
    const isNeutralPlacement = isNeutralPlacementMove(move);

    if (!isNeutralPlacement && !move.actorColor) {
      throw new GameIntegrityError(InternalGameIntegrityReason.MoveDataIncomplete);
    }

    boardState[move.position.row][move.position.col] = isNeutralPlacement ? "neutral" : move.actorColor!;

    if (isNeutralPlacement) {
      return {
        ...game,
        boardState,
        moveHistory: [...game.moveHistory, move],
        status: "active",
        suggestedColor: "blue",
        farmland: farmlandSummary(boardState),
        lastActivityAt: move.createdAt,
        lastActionAt: move.createdAt,
        updatedAt: move.createdAt,
      };
    }

    for (const capturedPosition of move.captured) {
      boardState[capturedPosition.row][capturedPosition.col] = null;
    }

    const outcome = getPlacementOutcome(boardState, move.captured.length);

    return {
      ...game,
      boardState,
      moveHistory: [...game.moveHistory, move],
      status: outcome.status,
      suggestedColor: otherColor(move.actorColor!),
      farmland: outcome.farmland,
      lastActivityAt: move.createdAt,
      lastActionAt: move.createdAt,
      updatedAt: move.createdAt,
    };
  }

  if (move.type === "pass") {
    if (!move.actorColor) {
      throw new GameIntegrityError(InternalGameIntegrityReason.PassDataIncomplete);
    }

    const farmland = farmlandSummary(game.boardState);
    const shouldFinish = shouldFinishAfterPass(game.moveHistory);

    return {
      ...game,
      moveHistory: [...game.moveHistory, move],
      status: shouldFinish ? "finished" : "active",
      suggestedColor: otherColor(move.actorColor),
      farmland,
      lastActivityAt: move.createdAt,
      lastActionAt: move.createdAt,
      updatedAt: move.createdAt,
    };
  }

  if (move.type === "finish") {
    const farmland = farmlandSummary(game.boardState);

    return {
      ...game,
      moveHistory: [...game.moveHistory, move],
      status: "finished",
      farmland,
      lastActivityAt: move.createdAt,
      lastActionAt: move.createdAt,
      updatedAt: move.createdAt,
    };
  }

  const boardState = createInitialBoard();

  return {
    ...game,
    boardState,
    moveHistory: [...game.moveHistory, move],
    status: "active",
    suggestedColor: "blue",
    farmland: farmlandSummary(boardState),
    lastActivityAt: move.createdAt,
    lastActionAt: move.createdAt,
    updatedAt: move.createdAt,
  };
}

function replayGameToMoveHistory(game: GameDocument, moveHistory: MoveEvent[]) {
  let replayedGame = createBaseGameState(game);

  for (const historicalMove of moveHistory) {
    replayedGame = applyRecordedMove(replayedGame, historicalMove);
  }

  return replayedGame;
}

export function createInitialBoard() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null as PieceState),
  );
}

export function createNewGameDocument(gameId: string): GameDocument {
  const now = new Date();
  const boardState = createInitialBoard();

  return {
    gameId,
    boardState,
    moveHistory: [],
    status: "active",
    suggestedColor: "blue",
    showScoresAndLands: true,
    farmland: farmlandSummary(boardState),
    lastActivityAt: now,
    lastActionAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function assertCanMutate(game: GameDocument) {
  if (game.status === "finished") {
    throw new GameRuleError(PUBLIC_GAME_RULE_ERROR_CODES.GAME_FINISHED);
  }
}

function assertTurnColor(game: GameDocument, color: PlayerColor) {
  if (color !== game.suggestedColor) {
    throw new GameRuleError(makeTurnErrorCode(game.suggestedColor));
  }
}

function applyPlacement(
  game: GameDocument,
  color: PlayerColor,
  row: number,
  col: number,
) {
  assertCanMutate(game);
  assertTurnColor(game, color);

  if (!isInBounds(row, col)) {
    throw new GameRuleError(PUBLIC_GAME_RULE_ERROR_CODES.OUTSIDE_BOARD);
  }

  if (game.boardState[row][col] !== null) {
    throw new GameRuleError(PUBLIC_GAME_RULE_ERROR_CODES.INTERSECTION_OCCUPIED);
  }

  if (!hasNeutral(game.boardState)) {
    const boardState = cloneBoard(game.boardState);
    boardState[row][col] = "neutral";
    const now = new Date();

    return {
      ...game,
      boardState,
      moveHistory: appendMove(game, {
        type: "place",
        actorColor: null,
        position: { row, col },
        captured: [],
        createdAt: now,
        note: NEUTRAL_PLACEMENT_NOTE,
      }),
      status: "active",
      suggestedColor: "blue",
      farmland: farmlandSummary(boardState),
      lastActivityAt: now,
      lastActionAt: now,
      updatedAt: now,
    } satisfies GameDocument;
  }

  const territories = collectTerritories(game.boardState);
  const targetPosition = `${row}:${col}`;

  if (territories.blue.has(targetPosition) || territories.orange.has(targetPosition)) {
    throw new GameRuleError(PUBLIC_GAME_RULE_ERROR_CODES.CLAIMED_FARMLAND);
  }

  const boardState = cloneBoard(game.boardState);
  boardState[row][col] = color;

  const captured = findCapturedPieces(boardState, { row, col }, color);
  for (const position of captured) {
    boardState[position.row][position.col] = null;
  }

  const placedGroup = getGroup(boardState, { row, col }, color);
  if (countLiberties(boardState, placedGroup) === 0) {
    throw new GameRuleError(PUBLIC_GAME_RULE_ERROR_CODES.NO_LIBERTIES);
  }

  const now = new Date();
  const outcome = getPlacementOutcome(boardState, captured.length);

  const nextGame: GameDocument = {
    ...game,
    boardState,
    moveHistory: appendMove(game, {
      type: "place",
      actorColor: color,
      position: { row, col },
      captured,
      createdAt: now,
    }),
    status: outcome.status,
    suggestedColor: otherColor(color),
    farmland: outcome.farmland,
    lastActivityAt: now,
    lastActionAt: now,
    updatedAt: now,
  };

  return nextGame;
}

function applyPass(game: GameDocument, color: PlayerColor) {
  assertCanMutate(game);
  assertTurnColor(game, color);

  const now = new Date();
  const farmland = farmlandSummary(game.boardState);
  const shouldFinish = shouldFinishAfterPass(game.moveHistory);

  return {
    ...game,
    moveHistory: appendMove(game, {
      type: "pass",
      actorColor: color,
      position: null,
      captured: [],
      createdAt: now,
    }),
    status: shouldFinish ? "finished" : "active",
    suggestedColor: otherColor(color),
    farmland,
    lastActivityAt: now,
    lastActionAt: now,
    updatedAt: now,
  } satisfies GameDocument;
}

function applyFinish(game: GameDocument) {
  assertCanMutate(game);

  const now = new Date();
  const farmland = farmlandSummary(game.boardState);
  const finishResult = farmland.blue - farmland.orange >= 3 ? "blue" : "orange";

  return {
    ...game,
    moveHistory: appendMove(game, {
      type: "finish",
      actorColor: null,
      position: null,
      captured: [],
      createdAt: now,
      note: `finished by territory: ${finishResult}`,
    }),
    status: "finished",
    farmland,
    lastActivityAt: now,
    lastActionAt: now,
    updatedAt: now,
  } satisfies GameDocument;
}

function applyReset(game: GameDocument) {
  const now = new Date();
  const boardState = createInitialBoard();

  return {
    ...game,
    boardState,
    moveHistory: [],
    status: "active",
    suggestedColor: "blue",
    showScoresAndLands: game.showScoresAndLands ?? true,
    farmland: farmlandSummary(boardState),
    lastActivityAt: now,
    lastActionAt: now,
    updatedAt: now,
  } satisfies GameDocument;
}

function applySetVisibility(game: GameDocument, showScoresAndLands: boolean) {
  const now = new Date();

  return {
    ...game,
    showScoresAndLands,
    lastActivityAt: now,
    updatedAt: now,
  } satisfies GameDocument;
}

function applyUndo(game: GameDocument) {
  if (game.moveHistory.length === 0) {
    throw new GameRuleError(PUBLIC_GAME_RULE_ERROR_CODES.NO_MOVES_TO_UNDO);
  }

  // Strip trailing passes, remove one non-pass move, then strip any newly exposed trailing passes.
  let end = game.moveHistory.length;
  while (end > 0 && game.moveHistory[end - 1].type === "pass") {
    end -= 1;
  }
  if (end > 0) {
    end -= 1;
  }
  while (end > 0 && game.moveHistory[end - 1].type === "pass") {
    end -= 1;
  }

  return replayGameToMoveHistory(game, game.moveHistory.slice(0, end));
}

export function applyGameAction(game: GameDocument, action: GameActionInput) {
  if (action.type === "place") {
    return applyPlacement(game, action.color, action.row, action.col);
  }

  if (action.type === "pass") {
    return applyPass(game, action.color);
  }

  if (action.type === "finish") {
    return applyFinish(game);
  }

  if (action.type === "undo") {
    return applyUndo(game);
  }

  if (action.type === "setVisibility") {
    return applySetVisibility(game, action.showScoresAndLands);
  }

  return applyReset(game);
}

export function isGameRuleError(error: unknown): error is GameRuleError {
  return error instanceof GameRuleError;
}

export function isGameIntegrityError(error: unknown): error is GameIntegrityError {
  return error instanceof GameIntegrityError;
}
