import type { PlayerId, Result } from "@/lib/games/types";

/** One published game, reduced to all the league layer is allowed to see. */
export type GameResults = readonly Result[];

/** Mirrors leagues.scoring_method. Only `table` is implemented in the MVP. */
export const scoringMethods = ["table", "elo", "points"] as const;

export type ScoringMethod = (typeof scoringMethods)[number];

export interface StandingRow {
  playerId: PlayerId;
  gamesPlayed: number;
  /** Placement 1 counts, including a placement shared with somebody else. */
  wins: number;
  /** Always a multiple of 0.5; see placementPoints. */
  placementPoints: number;
  /**
   * Position in this table, by standard competition ranking: players level on
   * both points and wins share a rank, and the next rank skips past them.
   */
  rank: number;
}

export interface StandingsOptions {
  /**
   * Players to list even though they appear in none of the games, so a league
   * table can show everybody. Players found in the games are always listed.
   */
  readonly players?: readonly PlayerId[];
}
