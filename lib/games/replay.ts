import { z } from "zod";

import { GameSetupError } from "./errors";
import type { GameModule, PlayerId } from "./types";

const playerIdsSchema = z.array(z.string().min(1));

/**
 * Validates the player list against the module's limits, then builds the
 * starting state. Modules' own `init` may assume it is given a valid roster.
 */
export function initGame<Config, State, Action>(
  module: GameModule<Config, State, Action>,
  config: Config,
  playerIds: readonly PlayerId[],
): State {
  const { min, max } = module.players;
  if (playerIds.length < min || playerIds.length > max) {
    throw new GameSetupError(
      `${module.id} takes ${min}-${max} players, got ${playerIds.length}`,
    );
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new GameSetupError(`${module.id}: the same player appears twice`);
  }
  return module.init(config, playerIds);
}

/**
 * Derives state from the action log, which is the only source of truth for a
 * game (handout §3.2). Undo is therefore replaying one action fewer, and a
 * module bug fixed today applies to every game recorded before it.
 */
export function replay<Config, State, Action>(
  module: GameModule<Config, State, Action>,
  config: Config,
  playerIds: readonly PlayerId[],
  actions: readonly Action[],
): State {
  // Not `actions.reduce(module.reduce, …)`: Array.prototype.reduce would call
  // reduce unbound and hand it the index and the whole array as extra
  // arguments.
  return actions.reduce<State>(
    (state, action) => module.reduce(state, action),
    initGame(module, config, playerIds),
  );
}

/** A game as it comes back out of the database: all three fields are jsonb. */
export interface StoredGame {
  config: unknown;
  playerIds: unknown;
  actions: unknown;
}

/**
 * Replays a game whose config, roster and action log have not been validated —
 * which is every game read back from Postgres. This is what the publish route
 * calls before trusting `results()`.
 */
export function replayStoredGame<Config, State, Action>(
  module: GameModule<Config, State, Action>,
  stored: StoredGame,
): State {
  const config = module.configSchema.parse(stored.config);
  const playerIds = playerIdsSchema.parse(stored.playerIds);
  const actions = z.array(module.actionSchema).parse(stored.actions);
  return replay(module, config, playerIds, actions);
}
