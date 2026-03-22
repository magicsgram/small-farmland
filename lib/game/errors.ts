import type { PlayerColor } from "@/lib/game/types";

/**
 * Public game rule error codes exposed to the client as i18n keys.
 */
export const PUBLIC_GAME_RULE_ERROR_CODES = {
  GAME_FINISHED: "errors.gameAlreadyFinished",
  OUTSIDE_BOARD: "errors.moveOutsideBoard",
  INTERSECTION_OCCUPIED: "errors.intersectionOccupied",
  CLAIMED_FARMLAND: "errors.cannotPlaceInFarmland",
  NO_LIBERTIES: "errors.moveWithoutLiberties",
  NO_MOVES_TO_UNDO: "errors.noMovesToUndo",
} as const;

type StaticPublicGameRuleErrorCode =
  (typeof PUBLIC_GAME_RULE_ERROR_CODES)[keyof typeof PUBLIC_GAME_RULE_ERROR_CODES];

type TurnPublicGameRuleErrorCode = "errors.notYourTurnBlue" | "errors.notYourTurnOrange";

export type PublicGameRuleErrorCode =
  | StaticPublicGameRuleErrorCode
  | TurnPublicGameRuleErrorCode;

/**
 * Internal game integrity reasons.
 * These are domain-internal diagnostics and must never be exposed as client i18n keys.
 */
export enum InternalGameIntegrityReason {
  MoveDataIncomplete,
  PassDataIncomplete,
}

/**
 * Helper to get the i18n error code for a turn error.
 * Constructs an error code based on player color: "errors.notYourTurnBlue" or "errors.notYourTurnOrange"
 */
export function makeTurnErrorCode(color: PlayerColor): TurnPublicGameRuleErrorCode {
  return color === "blue" ? "errors.notYourTurnBlue" : "errors.notYourTurnOrange";
}
