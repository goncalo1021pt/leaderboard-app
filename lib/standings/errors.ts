/**
 * Published results that cannot be turned into standings: a game with nobody
 * in it, a player counted twice, placements that are not a valid ranking.
 *
 * Standings are derived, never authoritative, so bad input has to be loud.
 * Silently skipping it would produce a table that looks fine and is wrong.
 */
export class StandingsDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StandingsDataError";
  }
}
