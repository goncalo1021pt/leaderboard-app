import { describe, expect, it } from "vitest";

import { GameSetupError } from "./errors";
import { generic, type GenericAction, type GenericConfig } from "./generic/module";
import { initGame, replay, replayStoredGame } from "./replay";

const config: GenericConfig = { scoreLabel: "Victory points", higherIsBetter: true };
const roster = ["ana", "bea", "caio"];

const finalScores: GenericAction = {
  type: "setResults",
  entries: [
    { playerId: "ana", score: 10 },
    { playerId: "bea", score: 8 },
    { playerId: "caio", score: 5 },
  ],
};

describe("initGame", () => {
  it("builds the starting state for a valid roster", () => {
    expect(generic.isComplete(initGame(generic, config, roster))).toBe(false);
  });

  it("rejects too few players", () => {
    expect(() => initGame(generic, config, ["ana"])).toThrow(GameSetupError);
  });

  it("rejects more players than the module accepts", () => {
    const crowd = Array.from({ length: generic.players.max + 1 }, (_, i) => `p${i}`);
    expect(() => initGame(generic, config, crowd)).toThrow(/takes 2-20 players, got 21/);
  });

  it("rejects the same player twice", () => {
    expect(() => initGame(generic, config, ["ana", "ana", "bea"])).toThrow(
      /appears twice/,
    );
  });
});

describe("replay", () => {
  it("with no actions equals the starting state", () => {
    expect(replay(generic, config, roster, [])).toEqual(
      initGame(generic, config, roster),
    );
  });

  it("applies the log to reach the finished game", () => {
    const state = replay(generic, config, roster, [finalScores]);
    expect(generic.isComplete(state)).toBe(true);
    expect(generic.scores(state)).toEqual({ ana: 10, bea: 8, caio: 5 });
  });

  it("makes undo mean replaying one action fewer", () => {
    const log = [finalScores];
    const undone = replay(generic, config, roster, log.slice(0, -1));
    expect(generic.isComplete(undone)).toBe(false);
    // And the undone action can be recorded again, which is the whole point.
    expect(generic.isComplete(replay(generic, config, roster, log))).toBe(true);
  });

  it("is deterministic", () => {
    expect(replay(generic, config, roster, [finalScores])).toEqual(
      replay(generic, config, roster, [finalScores]),
    );
  });
});

describe("replayStoredGame", () => {
  /** Everything comes back from Postgres as jsonb, so round-trip through JSON. */
  const stored = (overrides: Record<string, unknown> = {}) =>
    JSON.parse(
      JSON.stringify({ config, playerIds: roster, actions: [finalScores], ...overrides }),
    ) as { config: unknown; playerIds: unknown; actions: unknown };

  it("validates and replays a stored game", () => {
    const state = replayStoredGame(generic, stored());
    expect(generic.results(state).map((r) => r.playerId)).toEqual(["ana", "bea", "caio"]);
  });

  it("rejects a config that does not match the module", () => {
    expect(() =>
      replayStoredGame(generic, stored({ config: { scoreLabel: "Points" } })),
    ).toThrow();
  });

  it("rejects an action log that is not an array", () => {
    expect(() => replayStoredGame(generic, stored({ actions: "nope" }))).toThrow();
  });

  it("rejects a roster that is not a list of non-empty strings", () => {
    expect(() => replayStoredGame(generic, stored({ playerIds: ["ana", 7] }))).toThrow();
  });

  it("rejects an action the module does not recognise", () => {
    expect(() =>
      replayStoredGame(generic, stored({ actions: [{ type: "nextRound" }] })),
    ).toThrow();
  });
});
