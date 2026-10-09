import { describe, expect, it } from "vitest";

import { assignPlacements } from "./placements";

const p = (playerId: string, score: number) => ({ playerId, score });

describe("assignPlacements", () => {
  it("ranks best-first when a higher score wins", () => {
    expect(assignPlacements([p("bea", 8), p("ana", 10), p("caio", 5)], true)).toEqual([
      { playerId: "ana", score: 10, placement: 1 },
      { playerId: "bea", score: 8, placement: 2 },
      { playerId: "caio", score: 5, placement: 3 },
    ]);
  });

  it("ranks best-first when a lower score wins", () => {
    expect(assignPlacements([p("bea", 8), p("ana", 10), p("caio", 5)], false)).toEqual([
      { playerId: "caio", score: 5, placement: 1 },
      { playerId: "bea", score: 8, placement: 2 },
      { playerId: "ana", score: 10, placement: 3 },
    ]);
  });

  it("shares a placement across a tie and skips the positions it consumed", () => {
    // 10, 8, 8, 5 is 1st, joint 2nd, joint 2nd, then 4th — not 3rd. The skip is
    // what lets the standings layer tell how many positions the tie spanned.
    expect(
      assignPlacements([p("ana", 10), p("bea", 8), p("caio", 8), p("dina", 5)], true).map(
        (r) => r.placement,
      ),
    ).toEqual([1, 2, 2, 4]);
  });

  it("handles a tie for first", () => {
    expect(
      assignPlacements([p("ana", 10), p("bea", 10), p("caio", 4)], true).map(
        (r) => r.placement,
      ),
    ).toEqual([1, 1, 3]);
  });

  it("handles a tie for last", () => {
    expect(
      assignPlacements([p("ana", 10), p("bea", 5), p("caio", 5)], true).map(
        (r) => r.placement,
      ),
    ).toEqual([1, 2, 2]);
  });

  it("gives everyone first place when nobody wins", () => {
    expect(
      assignPlacements([p("ana", 7), p("bea", 7), p("caio", 7)], true).map(
        (r) => r.placement,
      ),
    ).toEqual([1, 1, 1]);
  });

  it("orders tied players by id, so two replays agree", () => {
    const entries = [p("zoe", 5), p("ana", 5), p("mia", 5)];
    expect(assignPlacements(entries, true).map((r) => r.playerId)).toEqual([
      "ana",
      "mia",
      "zoe",
    ]);
    // Same input in a different order must still come out the same way.
    expect(assignPlacements([...entries].reverse(), true).map((r) => r.playerId)).toEqual(
      ["ana", "mia", "zoe"],
    );
  });

  it("works at the two-player minimum", () => {
    expect(assignPlacements([p("ana", 1), p("bea", 2)], true)).toEqual([
      { playerId: "bea", score: 2, placement: 1 },
      { playerId: "ana", score: 1, placement: 2 },
    ]);
  });

  it("ranks negative and zero scores correctly", () => {
    expect(
      assignPlacements([p("ana", -5), p("bea", 0), p("caio", -12)], true).map(
        (r) => r.playerId,
      ),
    ).toEqual(["bea", "ana", "caio"]);
  });

  it("does not mutate its input", () => {
    const entries = [p("bea", 8), p("ana", 10)];
    const before = structuredClone(entries);
    assignPlacements(entries, true);
    expect(entries).toEqual(before);
  });
});
