import type { PlayerId } from "@/lib/games/types";

import { StandingsDataError } from "./errors";
import type { GameResults, StandingRow, StandingsOptions } from "./types";

/** How many players share each placement in one game. */
function tieGroupSizes(results: GameResults): Map<number, number> {
  const sizes = new Map<number, number>();
  for (const result of results) {
    sizes.set(result.placement, (sizes.get(result.placement) ?? 0) + 1);
  }
  return sizes;
}

/**
 * Rejects results that are not a standard competition ranking, which is what
 * `Result.placement` is defined as and what the points rule below assumes.
 *
 * Valid: 1, 2, 2, 4. Invalid: 1, 2, 2, 3 — dense ranking, where the tie group
 * size no longer tells you which positions the tie consumed, so the points
 * would come out wrong while looking perfectly reasonable.
 */
function assertRanking(results: GameResults): void {
  if (results.length === 0) {
    throw new StandingsDataError("a published game with no results");
  }

  const seen = new Set<PlayerId>();
  for (const result of results) {
    if (seen.has(result.playerId)) {
      throw new StandingsDataError(`${result.playerId} appears twice in the same game`);
    }
    seen.add(result.playerId);
  }

  const groups = [...tieGroupSizes(results)].sort(([a], [b]) => a - b);
  let expected = 1;
  for (const [placement, size] of groups) {
    if (placement !== expected) {
      throw new StandingsDataError(
        `placements are not a competition ranking: expected ${expected}, found ${placement}`,
      );
    }
    expected += size;
  }
}

/**
 * Placement points for one game (handout §4): in an N-player game the winner
 * takes N-1 and last takes 0.
 *
 * Tied players split the points for the positions they jointly occupy, so the
 * game always awards N(N-1)/2 in total and a draw is never worth more — or
 * less — than a clean result. Every value is a multiple of 0.5, which binary
 * floating point represents exactly, so the totals do not drift.
 */
export function placementPoints(results: GameResults): Map<PlayerId, number> {
  const playerCount = results.length;
  const sizes = tieGroupSizes(results);
  const points = new Map<PlayerId, number>();

  for (const result of results) {
    const tiedWith = sizes.get(result.placement) ?? 1;
    // The group occupies positions p … p+k-1; its mean position is
    // p + (k-1)/2, and a position q is worth N - q.
    points.set(result.playerId, playerCount - (result.placement + (tiedWith - 1) / 2));
  }

  return points;
}

interface Tally {
  gamesPlayed: number;
  wins: number;
  placementPoints: number;
}

/**
 * The `table` scoring method: games played, wins and total placement points,
 * ordered by points and then wins.
 */
export function buildTable(
  games: readonly GameResults[],
  options: StandingsOptions = {},
): StandingRow[] {
  const tallies = new Map<PlayerId, Tally>();

  const tallyFor = (playerId: PlayerId): Tally => {
    const existing = tallies.get(playerId);
    if (existing !== undefined) return existing;
    const fresh: Tally = { gamesPlayed: 0, wins: 0, placementPoints: 0 };
    tallies.set(playerId, fresh);
    return fresh;
  };

  // Seeded first so a league member with no games still gets a row.
  for (const playerId of options.players ?? []) {
    tallyFor(playerId);
  }

  for (const game of games) {
    assertRanking(game);
    const points = placementPoints(game);

    for (const result of game) {
      const tally = tallyFor(result.playerId);
      tally.gamesPlayed += 1;
      if (result.placement === 1) tally.wins += 1;
      tally.placementPoints += points.get(result.playerId) ?? 0;
    }
  }

  const sorted = [...tallies].map(([playerId, tally]) => ({ playerId, ...tally }));

  sorted.sort((a, b) => {
    if (a.placementPoints !== b.placementPoints) {
      return b.placementPoints - a.placementPoints;
    }
    if (a.wins !== b.wins) return b.wins - a.wins;
    // Player id only orders the display; it is not a sporting tiebreak, so two
    // players who reach here still share a rank below.
    if (a.playerId === b.playerId) return 0;
    return a.playerId < b.playerId ? -1 : 1;
  });

  let rank = 1;
  let previous: { placementPoints: number; wins: number } | undefined;

  return sorted.map((row, index) => {
    if (
      previous !== undefined &&
      (row.placementPoints !== previous.placementPoints || row.wins !== previous.wins)
    ) {
      rank = index + 1;
    }
    previous = row;
    return { ...row, rank };
  });
}
