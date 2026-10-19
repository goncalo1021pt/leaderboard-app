import { describe, expect, it } from "vitest";

import { assignPlacements } from "@/lib/games/placements";

import { computeStandings } from "./compute";
import { StandingsDataError } from "./errors";
import { buildTable } from "./table";

const aGame = assignPlacements(
  [
    { playerId: "ana", score: 10 },
    { playerId: "bea", score: 8 },
  ],
  true,
);

describe("computeStandings", () => {
  it("defaults to the table method", () => {
    expect(computeStandings([aGame])).toEqual(buildTable([aGame]));
  });

  it("passes options through", () => {
    expect(computeStandings([], "table", { players: ["ana"] })).toEqual([
      { playerId: "ana", gamesPlayed: 0, wins: 0, placementPoints: 0, rank: 1 },
    ]);
  });

  it.each(["elo", "points"] as const)("refuses %s until v2", (method) => {
    expect(() => computeStandings([aGame], method)).toThrow(StandingsDataError);
    expect(() => computeStandings([aGame], method)).toThrow(/not implemented until v2/);
  });
});
