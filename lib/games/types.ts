import type { ZodType } from "zod";

/**
 * A player inside a league. Deliberately not a user id: most players are guests
 * created by a scorekeeper and have no account (handout §2).
 */
export type PlayerId = string;

export interface Result {
  playerId: PlayerId;
  score: number;
  /**
   * Standard competition ranking. 1 is the winner, tied players share the
   * better placement, and the placement after a tie skips the positions the
   * tie used up: scores 10, 8, 8, 5 give placements 1, 2, 2, 4.
   *
   * The standings layer needs that skip to reconstruct which positions a tie
   * spanned, so it can split the placement points between them (handout §4).
   */
  placement: number;
}

/**
 * Everything the app needs to know about how a game is scored.
 *
 * Note one deliberate difference from handout §3.1: the interface carries no
 * `ui` field. Putting React components on the module object would make the
 * registry import them, which would in turn pull React into the publish route
 * that replays games server-side — the thing §12 forbids. UI components are
 * registered separately when the first screen needs them (step 6), keyed by
 * module id, so a game still lives in one folder.
 */
export interface GameModule<Config, State, Action> {
  /** Stable identifier. Stored on every game row; never reuse or rename one. */
  readonly id: string;
  readonly name: string;
  readonly players: { readonly min: number; readonly max: number };
  /** Bump whenever reduce or results semantics change. Stored per game. */
  readonly version: number;

  readonly defaultConfig: Config;
  readonly configSchema: ZodType<Config>;
  readonly actionSchema: ZodType<Action>;

  init(config: Config, playerIds: readonly PlayerId[]): State;

  /** Pure. Throws GameRuleError if the action cannot be applied. */
  reduce(state: State, action: Action): State;

  /** Running totals, defined at every point in the game. */
  scores(state: State): Record<PlayerId, number>;

  isComplete(state: State): boolean;

  /** Final standings. Throws unless isComplete(state). */
  results(state: State): Result[];
}
