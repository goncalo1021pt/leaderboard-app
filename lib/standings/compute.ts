import { StandingsDataError } from "./errors";
import { buildTable } from "./table";
import type { GameResults, ScoringMethod, StandingRow, StandingsOptions } from "./types";

/**
 * Turns published games into a standings table.
 *
 * The only input is `Result[]` per game, so no game module can ever affect how
 * standings are computed, and adding a game cannot break them (handout §9).
 * Called on read: the data is small and a cache would cost more in
 * invalidation than it saves.
 */
export function computeStandings(
  games: readonly GameResults[],
  method: ScoringMethod = "table",
  options: StandingsOptions = {},
): StandingRow[] {
  switch (method) {
    case "table":
      return buildTable(games, options);

    case "elo":
    case "points":
      // Both are v2 (handout §4). A league row carrying one should fail loudly
      // rather than quietly fall back to a different method and show numbers
      // nobody asked for.
      throw new StandingsDataError(
        `Scoring method "${method}" is not implemented until v2`,
      );
  }
}
