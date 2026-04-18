"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { AutoFitText } from "@/app/_components/auto-fit-text";
import { LanguageSelect } from "@/app/_components/language-select";
import {
  shouldIncludeLangInUrl,
  type LocaleMessages,
  type SupportedLanguage,
} from "@/lib/i18n";
import { getRuleSections } from "@/lib/ui/rules";
import type { GameActionInput, GameSnapshot, PieceState, PlayerColor } from "@/lib/game/types";

const PIECE_STYLES: Record<Exclude<PieceState, null>, string> = {
  blue: "bg-sky-300 shadow-none opacity-100",
  orange: "bg-orange-300 shadow-none opacity-100",
  neutral: "bg-[linear-gradient(135deg,#38bdf8_0%,#fb923c_100%)] shadow-none opacity-100",
};

const FARMLAND_CELL_STYLES = {
  blue: "bg-blue-900 opacity-100 dark:bg-blue-900",
  orange: "bg-amber-900 opacity-100 dark:bg-amber-900",
};

const NEUTRAL_PLACEMENT_NOTE = "placed neutral farmhouse";


type FarmlandOwner = "blue" | "orange";
type PieceType = Exclude<PieceState, null>;

function positionKey(row: number, col: number) {
  return `${row}:${col}`;
}

function otherColor(color: PlayerColor): PlayerColor {
  return color === "blue" ? "orange" : "blue";
}

function getNeighbors(row: number, col: number, boardSize: number) {
  const candidates = [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ];

  return candidates.filter(
    (candidate) =>
      candidate.row >= 0 && candidate.row < boardSize && candidate.col >= 0 && candidate.col < boardSize,
  );
}

function collectClaimedFarmland(boardState: PieceState[][]) {
  const boardSize = boardState.length;
  const visited = new Set<string>();
  const farmland = new Map<string, FarmlandOwner>();

  for (let row = 0; row < boardSize; row += 1) {
    for (let col = 0; col < boardSize; col += 1) {
      if (boardState[row][col] !== null) {
        continue;
      }

      const startKey = positionKey(row, col);
      if (visited.has(startKey)) {
        continue;
      }

      const queue = [{ row, col }];
      const region: Array<{ row: number; col: number }> = [];
      const borderColors = new Set<FarmlandOwner | "neutral">();
      const touchedBoardSides = new Set<"top" | "right" | "bottom" | "left">();

      visited.add(startKey);

      while (queue.length > 0) {
        const current = queue.shift();

        if (!current) {
          continue;
        }

        region.push(current);

        if (current.row === 0) {
          touchedBoardSides.add("top");
        }

        if (current.row === boardSize - 1) {
          touchedBoardSides.add("bottom");
        }

        if (current.col === 0) {
          touchedBoardSides.add("left");
        }

        if (current.col === boardSize - 1) {
          touchedBoardSides.add("right");
        }

        for (const neighbor of getNeighbors(current.row, current.col, boardSize)) {
          const value = boardState[neighbor.row][neighbor.col];

          if (value === null) {
            const key = positionKey(neighbor.row, neighbor.col);

            if (!visited.has(key)) {
              visited.add(key);
              queue.push(neighbor);
            }

            continue;
          }

          borderColors.add(value);
        }
      }

      if (touchedBoardSides.size === 4) {
        continue;
      }

      const ownerCandidates = ["blue", "orange"].filter((color) =>
        borderColors.has(color as FarmlandOwner),
      ) as FarmlandOwner[];

      if (ownerCandidates.length !== 1) {
        continue;
      }

      const owner = ownerCandidates[0];

      for (const position of region) {
        farmland.set(positionKey(position.row, position.col), owner);
      }
    }
  }

  return farmland;
}

function calculateFarmlandCount(boardState: PieceState[][]): { blue: number; orange: number } {
  const claimedFarmland = collectClaimedFarmland(boardState);
  const counts = { blue: 0, orange: 0 };

  for (const owner of claimedFarmland.values()) {
    if (owner === "blue") {
      counts.blue += 1;
    } else if (owner === "orange") {
      counts.orange += 1;
    }
  }

  return counts;
}

function inferWinner(
  status: GameSnapshot["status"],
  moveHistory: GameSnapshot["moveHistory"],
  farmlandCount: { blue: number; orange: number },
): PlayerColor | null {
  if (status !== "finished") {
    return null;
  }

  const latestMove = moveHistory.at(-1);

  if (
    latestMove?.type === "place"
    && latestMove.actorColor
    && latestMove.captured.length > 0
  ) {
    return latestMove.actorColor;
  }

  return farmlandCount.blue - farmlandCount.orange >= 3 ? "blue" : "orange";
}
function resolveFarmlandTintOwner(
  row: number,
  col: number,
  piece: PieceState,
  boardState: PieceState[][],
  claimedFarmland: Map<string, FarmlandOwner>,
  boardSize: number,
) {
  if (piece === "blue" || piece === "orange") {
    return piece;
  }

  const directOwner = claimedFarmland.get(positionKey(row, col));

  if (directOwner) {
    return directOwner;
  }

  if (piece !== "neutral") {
    return null;
  }

  const queue = [{ row, col }];
  const visited = new Set<string>([positionKey(row, col)]);
  const borderColors = new Set<FarmlandOwner | "neutral">();
  const touchedBoardSides = new Set<"top" | "right" | "bottom" | "left">();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    if (current.row === 0) {
      touchedBoardSides.add("top");
    }

    if (current.row === boardSize - 1) {
      touchedBoardSides.add("bottom");
    }

    if (current.col === 0) {
      touchedBoardSides.add("left");
    }

    if (current.col === boardSize - 1) {
      touchedBoardSides.add("right");
    }

    for (const neighbor of getNeighbors(current.row, current.col, boardSize)) {
      const neighborValue = boardState[neighbor.row][neighbor.col];

      if (neighborValue === null || neighborValue === "neutral") {
        const neighborKey = positionKey(neighbor.row, neighbor.col);

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
    return null;
  }

  const ownerCandidates = ["blue", "orange"].filter((color) =>
    borderColors.has(color as FarmlandOwner),
  ) as FarmlandOwner[];

  if (ownerCandidates.length === 1) {
    return ownerCandidates[0];
  }

  return null;
}

type GameRoomProps = {
  initialSnapshot: GameSnapshot;
  gameUrl: string;
  language: SupportedLanguage;
  messages: LocaleMessages;
};

const GAME_TITLE_CONTAINER_CLASS = "min-h-[3.6rem] pt-1 sm:min-h-[4.2rem] sm:pt-1.5";
const GAME_TITLE_MAX_PX = 46;
const GAME_TITLE_MIN_PX = 16;
const GAME_TITLE_TOP_INSET_EM = 0.24;
const GAME_TITLE_TEXT_CLASS = "font-black leading-[1.26] tracking-tight drop-shadow-[0_3px_10px_rgba(0,0,0,0.4)]";

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function GameRoom({
  initialSnapshot,
  gameUrl,
  language,
  messages,
}: GameRoomProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [copied, setCopied] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isHomeConfirmOpen, setIsHomeConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [highlightedCell, setHighlightedCell] = useState<string | null>(null);
  const ruleSections = useMemo(() => getRuleSections(messages), [messages]);
  const [isPending, startTransition] = useTransition();
  const homeHref = useMemo(
    () => (shouldIncludeLangInUrl(language) ? `/?lang=${language}` : "/"),
    [language],
  );
  const showScoresAndLandsLabel =
    messages["game.settings.showScoresAndClaimedFarmlands"] || "Show scores and claimed farmlands";
  const canPlayTurn = snapshot.status === "active";
  const hasNeutral = useMemo(
    () => snapshot.boardState.some((boardRow) => boardRow.includes("neutral")),
    [snapshot.boardState],
  );
  const shouldRevealScoresAndLands = snapshot.showScoresAndLands || snapshot.status === "finished";
  const farmlandCount = useMemo(
    () => calculateFarmlandCount(snapshot.boardState),
    [snapshot.boardState],
  );
  const inferredWinner = useMemo(
    () => inferWinner(snapshot.status, snapshot.moveHistory, farmlandCount),
    [snapshot.status, snapshot.moveHistory, farmlandCount],
  );
  const turnPrompt = snapshot.status === "finished"
    ? inferredWinner === "blue"
      ? messages["game.status.blueWins"]
      : messages["game.status.orangeWins"]
    : !hasNeutral
      ? messages["game.turn.placeNeutralFarmhouse"]
      : snapshot.suggestedColor === "blue"
        ? messages["game.turn.blueToPlay"]
        : messages["game.turn.orangeToPlay"];
  const turnPromptClass = snapshot.status === "finished"
    ? inferredWinner === "blue"
      ? "text-sky-300"
      : "text-orange-300"
    : !hasNeutral
      ? "text-stone-100"
      : snapshot.suggestedColor === "blue"
        ? "text-sky-300"
        : "text-orange-300";
  const claimedFarmland = useMemo(
    () => (shouldRevealScoresAndLands ? collectClaimedFarmland(snapshot.boardState) : new Map()),
    [shouldRevealScoresAndLands, snapshot.boardState],
  );
  const latestPlacedPiecePosition = useMemo(() => {
    for (let index = snapshot.moveHistory.length - 1; index >= 0; index -= 1) {
      const move = snapshot.moveHistory[index];

      if (move.type === "place" && move.note !== NEUTRAL_PLACEMENT_NOTE && move.position) {
        return move.position;
      }
    }

    return null;
  }, [snapshot.moveHistory]);
  const latestCapturedPieces = useMemo(() => {
    const latestMove = snapshot.moveHistory.at(-1);

    if (
      snapshot.status !== "finished"
      || !latestMove
      || latestMove.type !== "place"
      || !latestMove.actorColor
      || latestMove.captured.length === 0
    ) {
      return null;
    }

    return {
      color: otherColor(latestMove.actorColor),
      positions: new Set(latestMove.captured.map((position) => positionKey(position.row, position.col))),
    };
  }, [snapshot.moveHistory, snapshot.status]);
  useEffect(() => {
    const eventSource = new EventSource(`/api/games/${snapshot.gameId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { snapshot?: GameSnapshot };

        if (data.snapshot) {
          setSnapshot(data.snapshot);
        }
      } catch {
        // silently ignore
      }
    };

    return () => {
      eventSource.close();
    };
  }, [messages, snapshot.gameId]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (!isRulesOpen && !isHomeConfirmOpen && !isResetConfirmOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsRulesOpen(false);
        setIsHomeConfirmOpen(false);
        setIsResetConfirmOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isHomeConfirmOpen, isResetConfirmOpen, isRulesOpen]);

  function runAction(action: GameActionInput) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/games/${snapshot.gameId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(action),
        });

        const data = await readJson<{
          snapshot?: GameSnapshot;
        }>(response);

        if (response.ok && data.snapshot) {
          setSnapshot(data.snapshot);
        }
      } catch {
        // silently ignore
      }
    });
  }

  function handleCellClick(row: number, col: number) {
    if (snapshot.status === "finished") {
      return;
    }

    runAction({
      type: "place",
      color: snapshot.suggestedColor,
      row,
      col,
    });
  }

  async function handleCopyUrl() {
    const url = new URL(gameUrl, window.location.origin);

    if (shouldIncludeLangInUrl(language)) {
      url.searchParams.set("lang", language);
    }

    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
  }

  function handleConfirmHomeNavigation() {
    setIsHomeConfirmOpen(false);
    router.push(homeHref);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-2 pt-2 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <section className="border border-black/5 dark:border-white/10 sm:rounded-[2rem] sm:border-black/10 sm:bg-white/90 sm:p-6 sm:shadow-[0_25px_80px_rgba(18,35,24,0.08)] sm:backdrop-blur sm:dark:border-white/10 sm:dark:bg-black/70">
        <div className="grid gap-2 rounded-[1.25rem] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] sm:gap-6 lg:grid-cols-[1.6fr_0.95fr]">
          <div className="w-full rounded-[clamp(0.55rem,2vw,0.75rem)] border border-white/20 bg-[#323238] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] [border-width:clamp(1px,0.24vw,1.5px)] [padding:clamp(1px,0.45vw,2px)] dark:border-white/20 dark:bg-[#202024]">
            <div className="w-full">
              <div className="grid grid-cols-9 [gap:clamp(1.5px,0.85vw,4px)] [padding:clamp(1px,0.425vw,2px)] sm:[gap:clamp(3px,1.7vw,8px)] sm:[padding:clamp(2px,0.85vw,4px)]">
              {snapshot.boardState.map((boardRow, rowIndex) =>
                boardRow.map((piece, colIndex) => {
                  const cellKey = positionKey(rowIndex, colIndex);
                  const disabled = piece !== null || !canPlayTurn || isPending;
                  const defeatedPieceColor = piece === null && latestCapturedPieces?.positions.has(positionKey(rowIndex, colIndex))
                    ? latestCapturedPieces.color
                    : null;
                  const displayedPiece = piece ?? defeatedPieceColor;
                  const farmlandOwner = resolveFarmlandTintOwner(
                    rowIndex,
                    colIndex,
                    piece,
                    snapshot.boardState,
                    claimedFarmland,
                    snapshot.boardState.length,
                  );
                  const farmlandTintOwner = shouldRevealScoresAndLands
                    ? farmlandOwner
                    : piece === "blue" || piece === "orange"
                      ? piece
                      : null;
                  const isLatestPlacedPiece = (piece === "blue" || piece === "orange")
                    && latestPlacedPiecePosition?.row === rowIndex
                    && latestPlacedPiecePosition.col === colIndex;
                  const farmlandOverlayClass = farmlandTintOwner ? FARMLAND_CELL_STYLES[farmlandTintOwner] : null;
                  const isHighlighted = !disabled && highlightedCell === cellKey;

                  return (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      type="button"
                      aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}`}
                      disabled={disabled}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onPointerEnter={() => {
                        if (!disabled) {
                          setHighlightedCell(cellKey);
                        }
                      }}
                      onPointerLeave={() => {
                        setHighlightedCell((current) => (current === cellKey ? null : current));
                      }}
                      onFocus={() => {
                        if (!disabled) {
                          setHighlightedCell(cellKey);
                        }
                      }}
                      onBlur={() => {
                        setHighlightedCell((current) => (current === cellKey ? null : current));
                      }}
                      className={`relative aspect-square rounded-xl border border-black/15 bg-[rgba(24,24,27,0.92)] transition focus-visible:scale-[1.03] focus-visible:border-2 focus-visible:border-white/75 focus-visible:bg-[rgba(39,39,42,0.98)] focus-visible:outline-none disabled:cursor-default dark:border-white/12 dark:bg-[rgba(9,9,11,0.92)] dark:focus-visible:border-white/80 dark:focus-visible:bg-[rgba(24,24,27,0.98)] ${isHighlighted
                        ? "scale-[1.03] border-2 border-white/75 bg-[rgba(39,39,42,0.98)] dark:border-white/80 dark:bg-[rgba(24,24,27,0.98)]"
                        : ""}`}
                    >
                      {farmlandOverlayClass ? (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-0 rounded-[inherit] ${farmlandOverlayClass}`}
                        />
                      ) : null}
                      <span className="pointer-events-none absolute inset-0 grid place-items-center">
                        {displayedPiece ? (
                          <span className={`relative h-[68%] w-[68%] rounded-full ${PIECE_STYLES[displayedPiece]}`}>
                            {isLatestPlacedPiece ? (
                              <span className="absolute inset-0 grid place-items-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="h-[75%] w-[75%]"
                                  fill="none"
                                >
                                  <path
                                    d="M5 13.25L9.25 17.5L19 7.75"
                                    stroke="currentColor"
                                    strokeWidth="4.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-white"
                                  />
                                </svg>
                              </span>
                            ) : null}
                            {defeatedPieceColor ? (
                              <span className="absolute inset-0 grid place-items-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="h-[75%] w-[75%]"
                                  fill="none"
                                >
                                  <path
                                    d="M7 7L17 17"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    className="text-white"
                                  />
                                  <path
                                    d="M17 7L7 17"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    className="text-white"
                                  />
                                </svg>
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                }),
              )}
              </div>
            </div>
          </div>

          <aside className="mx-4 flex min-w-0 flex-col gap-3 self-start rounded-[1.5rem] bg-stone-950 px-3 py-4 text-stone-50 shadow-[0_18px_40px_rgba(17,24,39,0.3)] dark:bg-stone-900 max-[380px]:mx-2 max-[380px]:gap-2 max-[380px]:px-2.5 max-[380px]:py-3 sm:mx-0 sm:gap-4 sm:rounded-[1.75rem] sm:px-4 sm:py-5">
          <div className="order-5 flex items-center justify-between gap-2 lg:order-1">
            <LanguageSelect currentLanguage={language} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={messages["game.navigation.homeLabel"]}
                title={messages["game.navigation.homeLabel"]}
                onClick={() => setIsHomeConfirmOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-600 text-stone-100 transition hover:border-stone-400 max-[380px]:h-7 max-[380px]:w-7 sm:h-9 sm:w-9"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 10.5L12 3L21 10.5" />
                  <path d="M5.25 9.75V21H18.75V9.75" />
                  <path d="M9.75 21V14.25H14.25V21" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setIsRulesOpen(true)}
                className="inline-flex h-8 items-center justify-center rounded-full border border-stone-600 px-3 text-xs font-semibold text-stone-100 transition hover:border-stone-400 max-[380px]:h-7 max-[380px]:px-2.5 max-[380px]:text-[11px] sm:h-9"
              >
                {messages["landing.rules.title"]}
              </button>
            </div>
          </div>

          <div className="order-6 space-y-2 sm:space-y-3 lg:order-2">
            <div className={GAME_TITLE_CONTAINER_CLASS}>
              <AutoFitText
                maxPx={GAME_TITLE_MAX_PX}
                minPx={GAME_TITLE_MIN_PX}
                topInsetEm={GAME_TITLE_TOP_INSET_EM}
                className={GAME_TITLE_TEXT_CLASS}
              >
                <span className="text-sky-300">{messages["app.title.small"]}</span>{" "}
                <span className="text-orange-300">{messages["app.title.farmland"]}</span>
              </AutoFitText>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold tracking-tight max-[380px]:text-sm sm:text-xl">
                <span className="text-sky-300">{messages["game.meta.gameId"]}</span>{" "}
                <span className="text-orange-300">{snapshot.gameId}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="inline-flex h-9 w-full items-center justify-center rounded-full border border-stone-600 px-3 text-xs font-semibold text-stone-100 transition hover:border-stone-400 disabled:opacity-60 max-[380px]:h-8 max-[380px]:text-[11px] sm:h-10 sm:px-4 sm:text-sm"
            >
              {copied ? messages["game.actions.linkCopied"] : messages["game.actions.copyInvite"]}
            </button>
          </div>

          <div className="order-2 rounded-2xl bg-white/6 px-3 py-4 text-center max-[380px]:px-2.5 max-[380px]:py-3 sm:rounded-3xl sm:px-4 sm:py-6 lg:order-5">
            <AutoFitText maxPx={30} minPx={14} className={`font-semibold tracking-tight ${turnPromptClass}`}>{turnPrompt}</AutoFitText>
            {hasNeutral && canPlayTurn ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => runAction({ type: "pass", color: snapshot.suggestedColor })}
                className={`mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/20 px-3 text-xs font-semibold transition hover:border-white/50 disabled:cursor-wait disabled:opacity-60 max-[380px]:mt-2.5 max-[380px]:h-9 max-[380px]:text-[11px] sm:mt-4 sm:h-12 sm:text-sm ${turnPromptClass}`}
              >
                {messages["game.actions.pass"]}
              </button>
            ) : null}
          </div>

          <div className="order-3 grid gap-3 max-[380px]:gap-2 sm:grid-cols-2 lg:order-6 lg:grid-cols-1 xl:grid-cols-2">
            <button
              type="button"
              disabled={isPending || snapshot.moveHistory.length === 0}
              onClick={() => runAction({ type: "undo" })}
              className="inline-flex h-10 items-center justify-center rounded-full border border-amber-300/40 px-3 text-xs font-semibold text-amber-100 transition hover:border-amber-200 disabled:cursor-wait disabled:opacity-60 max-[380px]:h-9 max-[380px]:text-[11px] sm:h-12 sm:px-4 sm:text-sm"
            >
              {messages["game.actions.undo"]}
            </button>
            <button
              type="button"
              disabled={isPending || !hasNeutral}
              onClick={() => setIsResetConfirmOpen(true)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/20 px-3 text-xs font-semibold text-white transition hover:border-white/50 disabled:cursor-wait disabled:opacity-60 max-[380px]:h-9 max-[380px]:text-[11px] sm:h-12 sm:px-4 sm:text-sm"
            >
              {messages["game.actions.reset"]}
            </button>
          </div>

          <label className="order-4 flex items-center gap-2 rounded-2xl bg-white/6 px-3 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm lg:order-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/30 bg-transparent accent-[var(--accent)]"
              checked={snapshot.showScoresAndLands}
              disabled={isPending}
              onChange={(event) =>
                runAction({
                  type: "setVisibility",
                  showScoresAndLands: event.target.checked,
                })
              }
            />
            <span className="text-stone-100 leading-tight">{showScoresAndLandsLabel}</span>
          </label>

          <div className="order-1 grid grid-cols-2 gap-2 rounded-2xl bg-white/6 p-3 max-[380px]:gap-1.5 max-[380px]:p-2.5 sm:gap-3 sm:rounded-3xl sm:p-4 lg:order-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 sm:text-xs sm:tracking-[0.28em]">{messages["game.farmland.blue"]}</p>
                <p className="mt-1 text-xl font-semibold text-sky-300 max-[380px]:mt-0.5 max-[380px]:text-lg sm:mt-2 sm:text-2xl">{shouldRevealScoresAndLands ? farmlandCount.blue : "?"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 sm:text-xs sm:tracking-[0.28em]">{messages["game.farmland.orange"]}</p>
                <p className="mt-1 text-xl font-semibold text-orange-300 max-[380px]:mt-0.5 max-[380px]:text-lg sm:mt-2 sm:text-2xl">{shouldRevealScoresAndLands ? farmlandCount.orange : "?"}</p>
            </div>
          </div>

          <div aria-hidden="true" className="order-5 my-2 border-t border-white/10 lg:order-4" />
          </aside>
        </div>
      </section>

      {isRulesOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
          role="presentation"
          onClick={() => setIsRulesOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-modal-title"
            className="w-full max-w-2xl rounded-3xl border border-white/15 bg-stone-950 p-4 text-left text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="rules-modal-title" className="text-lg font-bold tracking-tight sm:text-xl">
                {messages["landing.rules.title"]}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setIsRulesOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-lg leading-none text-white transition hover:border-white/60"
              >
                ×
              </button>
            </div>

            <dl className="space-y-4 text-sm text-stone-200 sm:text-base">
              {ruleSections.map((section) => (
                <div key={section.title}>
                  <dt className="font-semibold text-stone-100">{section.title}</dt>
                  <dd>
                    <ul className="mt-1 space-y-1 ps-4">
                      {section.bullets.map((bullet, i) => (
                        <li key={i} className="flex gap-2">
                          <span aria-hidden="true" className="shrink-0 select-none text-stone-500">—</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}

      {isResetConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
          role="presentation"
          onClick={() => setIsResetConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-confirm-title"
            aria-describedby="reset-confirm-description"
            className="w-full max-w-md rounded-3xl border border-white/15 bg-stone-950 p-5 text-left text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="reset-confirm-title" className="text-lg font-bold tracking-tight sm:text-xl">
                  {messages["game.actions.confirmResetTitle"]}
                </h2>
                <p id="reset-confirm-description" className="mt-2 text-sm text-stone-300 sm:text-base">
                  {messages["game.actions.confirmResetDescription"]}
                </p>
              </div>
              <button
                type="button"
                aria-label={messages["game.actions.confirmResetCancel"]}
                onClick={() => setIsResetConfirmOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 text-lg leading-none text-white transition hover:border-white/60"
              >
                ×
              </button>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/20 px-4 text-sm font-semibold text-stone-100 transition hover:border-white/50"
              >
                {messages["game.actions.confirmResetCancel"]}
              </button>
              <button
                type="button"
                onClick={() => { setIsResetConfirmOpen(false); runAction({ type: "reset" }); }}
                className="inline-flex h-10 items-center justify-center rounded-full border border-amber-300/40 px-4 text-sm font-semibold text-amber-100 transition hover:border-amber-200"
              >
                {messages["game.actions.confirmResetConfirm"]}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isHomeConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
          role="presentation"
          onClick={() => setIsHomeConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-confirm-title"
            aria-describedby="home-confirm-description"
            className="w-full max-w-md rounded-3xl border border-white/15 bg-stone-950 p-5 text-left text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="home-confirm-title" className="text-lg font-bold tracking-tight sm:text-xl">
                  {messages["game.navigation.confirmHomeTitle"]}
                </h2>
                <p id="home-confirm-description" className="mt-2 text-sm text-stone-300 sm:text-base">
                  {messages["game.navigation.confirmHomeDescription"]}
                </p>
              </div>
              <button
                type="button"
                aria-label={messages["game.navigation.confirmHomeCancel"]}
                onClick={() => setIsHomeConfirmOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 text-lg leading-none text-white transition hover:border-white/60"
              >
                ×
              </button>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsHomeConfirmOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/20 px-4 text-sm font-semibold text-stone-100 transition hover:border-white/50"
              >
                {messages["game.navigation.confirmHomeCancel"]}
              </button>
              <button
                type="button"
                onClick={handleConfirmHomeNavigation}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_40px_rgba(27,88,62,0.2)]"
              >
                {messages["game.navigation.confirmHomeConfirm"]}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}