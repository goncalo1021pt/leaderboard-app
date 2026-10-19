import { describe, expect, it } from "vitest";

import { assignPlacements } from "@/lib/games/placements";

import { StandingsDataError } from "./errors";
import { buildTable, placementPoints } from "./table";
import type { GameResults } from "./types";

/**
 * Builds a game from final scores using the engine's own ranking, so these
 * tests consume exactly what a published game would contain.
 */
const game = (scores: Record<string, number>, higherIsBetter = true): GameResults =>
  assignPlacements(
    Object.entries(scores).map(([playerId, score]) => ({ playerId, score })),
    higherIsBetter,
  );

const pointsFor = (scores: Record<string, number>) =>
  Object.fromEntries(placementPoints(game(scores)));

const total = (scores: Record<string, number>) =>
  [...placementPoints(game(scores)).values()].reduce((sum, n) => sum + n, 0);

describe("placementPoints", () => {
  it("gives the winner N-1 and last place nothing", () => {
    expect(pointsFor({ ana: 10, bea: 8, caio: 6, dina: 4 })).toEqual({
      ana: 3,
      bea: 2,
      caio: 1,
      dina: 0,
    });
  });

  it("scales with the number of players", () => {
    expect(pointsFor({ ana: 2, bea: 1 })).toEqual({ ana: 1, bea: 0 });
    expect(pointsFor({ ana: 3, bea: 2, caio: 1 })).toEqual({ ana: 2, bea: 1, caio: 0 });
  });

  it("splits the positions a tie consumed", () => {
    // 2nd and 3rd are worth 2 and 1; sharing them gives 1.5 each.
    expect(pointsFor({ ana: 10, bea: 8, caio: 8, dina: 4 })).toEqual({
      ana: 3,
      bea: 1.5,
      caio: 1.5,
      dina: 0,
    });
  });

  it("splits a tie for first", () => {
    expect(pointsFor({ ana: 10, bea: 10, caio: 6, dina: 4 })).toEqual({
      ana: 2.5,
      bea: 2.5,
      caio: 1,
      dina: 0,
    });
  });

  it("gives everyone the same when nobody wins", () => {
    expect(pointsFor({ ana: 7, bea: 7, caio: 7, dina: 7 })).toEqual({
      ana: 1.5,
      bea: 1.5,
      caio: 1.5,
      dina: 1.5,
    });
  });

  it.each([
    ["no ties", { ana: 10, bea: 8, caio: 6, dina: 4 }],
    ["a tie for first", { ana: 10, bea: 10, caio: 6, dina: 4 }],
    ["a tie in the middle", { ana: 10, bea: 8, caio: 8, dina: 4 }],
    ["a tie for last", { ana: 10, bea: 8, caio: 4, dina: 4 }],
    ["a three-way tie", { ana: 10, bea: 8, caio: 8, dina: 8 }],
    ["everyone level", { ana: 7, bea: 7, caio: 7, dina: 7 }],
  ])("awards the same total with %s", (_label, scores) => {
    // N(N-1)/2 for N=4. This is the whole reason ties share an average: a draw
    // must not create or destroy points.
    expect(total(scores)).toBe(6);
  });
});

describe("buildTable", () => {
  it("is empty when nothing has been played", () => {
    expect(buildTable([])).toEqual([]);
  });

  it("lists league members who have not played yet", () => {
    expect(buildTable([], { players: ["bea", "ana"] })).toEqual([
      { playerId: "ana", gamesPlayed: 0, wins: 0, placementPoints: 0, rank: 1 },
      { playerId: "bea", gamesPlayed: 0, wins: 0, placementPoints: 0, rank: 1 },
    ]);
  });

  it("summarises a single game", () => {
    expect(buildTable([game({ ana: 10, bea: 8, caio: 6 })])).toEqual([
      { playerId: "ana", gamesPlayed: 1, wins: 1, placementPoints: 2, rank: 1 },
      { playerId: "bea", gamesPlayed: 1, wins: 0, placementPoints: 1, rank: 2 },
      { playerId: "caio", gamesPlayed: 1, wins: 0, placementPoints: 0, rank: 3 },
    ]);
  });

  it("accumulates across games", () => {
    // ana wins the first (2 points), bea the second (2), so bea finishes ahead
    // on 3 points to ana's 2 despite each winning once.
    expect(
      buildTable([game({ ana: 10, bea: 8, caio: 6 }), game({ ana: 1, bea: 9, caio: 5 })]),
    ).toEqual([
      { playerId: "bea", gamesPlayed: 2, wins: 1, placementPoints: 3, rank: 1 },
      { playerId: "ana", gamesPlayed: 2, wins: 1, placementPoints: 2, rank: 2 },
      { playerId: "caio", gamesPlayed: 2, wins: 0, placementPoints: 1, rank: 3 },
    ]);
  });

  it("counts a shared first place as a win for everyone in it", () => {
    const table = buildTable([game({ ana: 10, bea: 10, caio: 6 })]);
    expect(table.filter((row) => row.wins === 1).map((row) => row.playerId)).toEqual([
      "ana",
      "bea",
    ]);
  });

  it("handles players who appear in different games", () => {
    const table = buildTable([game({ ana: 10, bea: 8 }), game({ caio: 10, dina: 8 })]);
    expect(table.map((row) => [row.playerId, row.gamesPlayed])).toEqual([
      ["ana", 1],
      ["caio", 1],
      ["bea", 1],
      ["dina", 1],
    ]);
  });

  it("makes a win in a bigger game worth more", () => {
    // Inherent to §4: the winner takes N-1, so beating four people beats
    // beating one. Asserted so the consequence is a decision, not a surprise.
    const table = buildTable([
      game({ ana: 10, bea: 9, caio: 8, dina: 7, eva: 6 }),
      game({ fil: 10, gil: 9 }),
    ]);
    expect(table[0]?.playerId).toBe("ana");
    expect(table[0]?.placementPoints).toBe(4);
    expect(table.find((row) => row.playerId === "fil")?.placementPoints).toBe(1);
  });

  it("breaks equal points by wins, then shares and skips ranks", () => {
    // ana: one win in a 3-player game, so 2 points from 1 win.
    // dina: the same, from a different game.
    // bea: two second places, so also 2 points but no win.
    // caio and eva: last place in one game each, 0 and 0.
    const table = buildTable([
      game({ ana: 10, bea: 8, caio: 6 }),
      game({ dina: 10, bea: 8, eva: 6 }),
    ]);

    expect(table).toEqual([
      { playerId: "ana", gamesPlayed: 1, wins: 1, placementPoints: 2, rank: 1 },
      { playerId: "dina", gamesPlayed: 1, wins: 1, placementPoints: 2, rank: 1 },
      // Level on points with the two above, behind them on wins.
      { playerId: "bea", gamesPlayed: 2, wins: 0, placementPoints: 2, rank: 3 },
      // Rank 3 was taken by one player, so the next rank is 4.
      { playerId: "caio", gamesPlayed: 1, wins: 0, placementPoints: 0, rank: 4 },
      { playerId: "eva", gamesPlayed: 1, wins: 0, placementPoints: 0, rank: 4 },
    ]);
  });

  it("shares first place when two players tie a game", () => {
    expect(buildTable([game({ ana: 5, bea: 5, caio: 1 })])).toEqual([
      { playerId: "ana", gamesPlayed: 1, wins: 1, placementPoints: 1.5, rank: 1 },
      { playerId: "bea", gamesPlayed: 1, wins: 1, placementPoints: 1.5, rank: 1 },
      { playerId: "caio", gamesPlayed: 1, wins: 0, placementPoints: 0, rank: 3 },
    ]);
  });

  it("does not mutate the games it was given", () => {
    const games = [game({ ana: 10, bea: 8 })];
    const before = structuredClone(games);
    buildTable(games);
    expect(games).toEqual(before);
  });

  describe("rejects results it cannot trust", () => {
    it("a game with nobody in it", () => {
      expect(() => buildTable([[]])).toThrow(StandingsDataError);
    });

    it("the same player counted twice", () => {
      expect(() =>
        buildTable([
          [
            { playerId: "ana", score: 10, placement: 1 },
            { playerId: "ana", score: 8, placement: 2 },
          ],
        ]),
      ).toThrow(/appears twice/);
    });

    it("dense ranking instead of competition ranking", () => {
      expect(() =>
        buildTable([
          [
            { playerId: "ana", score: 10, placement: 1 },
            { playerId: "bea", score: 8, placement: 2 },
            { playerId: "caio", score: 8, placement: 2 },
            // Competition ranking would make this 4th.
            { playerId: "dina", score: 5, placement: 3 },
          ],
        ]),
      ).toThrow(/not a competition ranking/);
    });

    it("placements that do not start at 1", () => {
      expect(() =>
        buildTable([
          [
            { playerId: "ana", score: 10, placement: 2 },
            { playerId: "bea", score: 8, placement: 3 },
          ],
        ]),
      ).toThrow(StandingsDataError);
    });
  });
});
