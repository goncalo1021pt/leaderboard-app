import { z } from "zod";

import { GameRuleError } from "../errors";
import { assignPlacements } from "../placements";
import type { GameModule, PlayerId } from "../types";

export const genericConfigSchema = z.object({
  /** What the number means: "Victory points", "Pins", "Chips". */
  scoreLabel: z.string().min(1),
  higherIsBetter: z.boolean(),
  /**
   * Extra per-game fields a custom preset wants to collect (handout §3.3).
   * Scoring ignores them entirely; they exist so the preset form can render
   * them at step 6.
   */
  fields: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(["text", "number"]),
      }),
    )
    .optional(),
});

export type GenericConfig = z.infer<typeof genericConfigSchema>;

export const genericActionSchema = z.object({
  type: z.literal("setResults"),
  entries: z
    .array(
      z.object({
        playerId: z.string().min(1),
        // Zod 4's z.number() already rejects NaN and Infinity.
        score: z.number(),
      }),
    )
    .min(1),
});

export type GenericAction = z.infer<typeof genericActionSchema>;

export interface GenericState {
  readonly playerIds: readonly PlayerId[];
  readonly higherIsBetter: boolean;
  /** null until the single setResults action is recorded. */
  readonly recorded: Readonly<Record<PlayerId, number>> | null;
}

/**
 * The module behind every result-only game: Catan, Dune, bowling, and any
 * preset a user invents. Exactly one action is ever recorded, carrying the
 * final score for every player, so there is nothing to score round by round.
 */
export const generic: GameModule<GenericConfig, GenericState, GenericAction> = {
  id: "generic",
  name: "Result only",
  // Two is the floor because a placement needs somebody to beat. The ceiling is
  // generous: this module backs user-defined games as well as the built-ins,
  // and a preset can tighten it later.
  players: { min: 2, max: 20 },
  version: 1,

  defaultConfig: { scoreLabel: "Score", higherIsBetter: true },
  configSchema: genericConfigSchema,
  actionSchema: genericActionSchema,

  init(config, playerIds) {
    return {
      // Copied: callers keep editing their own array.
      playerIds: [...playerIds],
      higherIsBetter: config.higherIsBetter,
      recorded: null,
    };
  },

  reduce(state, action) {
    // Actions arrive from a jsonb column, so reduce validates its own input
    // rather than trusting that a caller parsed it first.
    const parsed = genericActionSchema.safeParse(action);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.join(".");
      throw new GameRuleError(
        `generic: invalid action${where ? ` at ${where}` : ""} - ${
          issue?.message ?? "does not match the action schema"
        }`,
      );
    }

    if (state.recorded !== null) {
      throw new GameRuleError(
        "generic: results are already recorded; undo before recording again",
      );
    }

    const expected = new Set(state.playerIds);
    const recorded: Record<PlayerId, number> = {};

    for (const entry of parsed.data.entries) {
      if (!expected.has(entry.playerId)) {
        throw new GameRuleError(`generic: ${entry.playerId} is not in this game`);
      }
      if (Object.hasOwn(recorded, entry.playerId)) {
        throw new GameRuleError(`generic: ${entry.playerId} has two scores`);
      }
      recorded[entry.playerId] = entry.score;
    }

    const missing = state.playerIds.filter((id) => !Object.hasOwn(recorded, id));
    if (missing.length > 0) {
      throw new GameRuleError(`generic: no score recorded for ${missing.join(", ")}`);
    }

    return { ...state, recorded };
  },

  scores(state) {
    if (state.recorded !== null) {
      return { ...state.recorded };
    }
    // Defined before anything is recorded, so a scoreboard can render a game
    // that has only just started.
    return Object.fromEntries(state.playerIds.map((id) => [id, 0]));
  },

  isComplete(state) {
    return state.recorded !== null;
  },

  results(state) {
    const { recorded } = state;
    if (recorded === null) {
      throw new GameRuleError("generic: no results until the scores are recorded");
    }
    return assignPlacements(
      Object.entries(recorded).map(([playerId, score]) => ({ playerId, score })),
      state.higherIsBetter,
    );
  },
};
