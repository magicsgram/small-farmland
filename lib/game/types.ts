export const BOARD_SIZE = 9;
export const CENTER_INDEX = Math.floor(BOARD_SIZE / 2);

export type PlayerColor = "blue" | "orange";
export type PieceState = PlayerColor | "neutral" | null;
export type GameStatus = "active" | "finished";
export type FarmlandOwner = PlayerColor | null;

export type BoardPosition = {
  row: number;
  col: number;
};

export type FarmlandSummary = {
  blue: number;
  orange: number;
};

export type MoveEvent = {
  type: "place" | "pass" | "finish" | "reset";
  actorColor: PlayerColor | null;
  position: BoardPosition | null;
  captured: BoardPosition[];
  createdAt: Date;
  note?: string;
};

export type GameDocument = {
  gameId: string;
  boardState: PieceState[][];
  moveHistory: MoveEvent[];
  status: GameStatus;
  suggestedColor: PlayerColor;
  showScoresAndLands?: boolean;
  farmland?: FarmlandSummary;
  lastActivityAt: Date;
  lastActionAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type GameSnapshot = {
  gameId: string;
  boardState: PieceState[][];
  moveHistory: Array<{
    type: "place" | "pass" | "finish" | "reset";
    actorColor: PlayerColor | null;
    position: BoardPosition | null;
    captured: BoardPosition[];
    createdAt: string;
    note?: string;
  }>;
  status: GameStatus;
  suggestedColor: PlayerColor;
  showScoresAndLands: boolean;
  farmland?: FarmlandSummary;
  lastActivityAt: string;
  lastActionAt: string;
  createdAt: string;
  updatedAt: string;
};

export type GameActionInput =
  | {
      type: "place";
      color: PlayerColor;
      row: number;
      col: number;
    }
  | {
      type: "pass";
      color: PlayerColor;
    }
  | {
      type: "finish";
    }
  | {
      type: "reset";
    }
  | {
      type: "undo";
    }
  | {
      type: "setVisibility";
      showScoresAndLands: boolean;
    };