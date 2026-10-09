import type { PlayerId, Result } from "./types";

export interface ScoredPlayer {
  playerId: PlayerId;
  score: number;
}

/**
 * Turns final scores into placements using standard competition ranking, which
 * is what `Result.placement` is defined as. Shared by every module so the tie
 * rules are written and tested exactly once.
 *
 * Returned best-first. Within a tie the order is by player id, so replaying the
 * same game twice produces identical output — placements are unaffected either
 * way, but a stable order keeps diffs and snapshots meaningful.
 */
export function assignPlacements(
  entries: readonly ScoredPlayer[],
  higherIsBetter: boolean,
): Result[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.score !== b.score) {
      return higherIsBetter ? b.score - a.score : a.score - b.score;
    }
    if (a.playerId === b.playerId) return 0;
    return a.playerId < b.playerId ? -1 : 1;
  });

  const results: Result[] = [];
  let placement = 1;
  let previousScore: number | undefined;

  sorted.forEach((entry, index) => {
    if (previousScore !== undefined && entry.score !== previousScore) {
      placement = index + 1;
    }
    results.push({ playerId: entry.playerId, score: entry.score, placement });
    previousScore = entry.score;
  });

  return results;
}
