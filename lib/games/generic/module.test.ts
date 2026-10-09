import { describe, expect, it } from "vitest";

import { GameRuleError } from "../errors";
import { generic, type GenericAction, type GenericConfig } from "./module";

const baseConfig: GenericConfig = { scoreLabel: "Victory points", higherIsBetter: true };
const roster = ["ana", "bea", "caio"];

const start = (config: Partial<GenericConfig> = {}) =>
  generic.init({ ...baseConfig, ...config }, roster);

const setResults = (entries: { playerId: string; score: number }[]): GenericAction => ({
  type: "setResults",
  entries,
});

/** Actions arrive as jsonb, so the invalid ones have to be smuggled past TypeScript. */
const asAction = (value: unknown) => value as GenericAction;

describe("generic module metadata", () => {
  it("accepts its own default config", () => {
    expect(generic.configSchema.safeParse(generic.defaultConfig).success).toBe(true);
  });

  it("needs at least two players, because a placement needs an opponent", () => {
    expect(generic.players.min).toBe(2);
  });
});

describe("generic init", () => {
  it("starts incomplete with every player on zero", () => {
    const state = start();
    expect(generic.isComplete(state)).toBe(false);
    expect(generic.scores(state)).toEqual({ ana: 0, bea: 0, caio: 0 });
  });

  it("copies the roster it was handed", () => {
    const mutable = [...roster];
    const state = generic.init(baseConfig, mutable);
    mutable.push("intruder");
    expect(state.playerIds).toEqual(roster);
  });
});

describe("generic reduce", () => {
  it("records the final scores", () => {
    const state = generic.reduce(
      start(),
      setResults([
        { playerId: "ana", score: 10 },
        { playerId: "bea", score: 8 },
        { playerId: "caio", score: 5 },
      ]),
    );

    expect(generic.isComplete(state)).toBe(true);
    expect(generic.scores(state)).toEqual({ ana: 10, bea: 8, caio: 5 });
  });

  it("does not mutate the state it was given", () => {
    const before = start();
    const snapshot = structuredClone(before);
    generic.reduce(
      before,
      setResults([
        { playerId: "ana", score: 1 },
        { playerId: "bea", score: 2 },
        { playerId: "caio", score: 3 },
      ]),
    );
    expect(before).toEqual(snapshot);
  });

  it("ignores the order the entries arrive in", () => {
    const state = generic.reduce(
      start(),
      setResults([
        { playerId: "caio", score: 5 },
        { playerId: "ana", score: 10 },
        { playerId: "bea", score: 8 },
      ]),
    );
    expect(generic.scores(state)).toEqual({ ana: 10, bea: 8, caio: 5 });
  });

  const complete = () =>
    generic.reduce(
      start(),
      setResults([
        { playerId: "ana", score: 10 },
        { playerId: "bea", score: 8 },
        { playerId: "caio", score: 5 },
      ]),
    );

  it("refuses a second set of results", () => {
    expect(() =>
      generic.reduce(
        complete(),
        setResults([
          { playerId: "ana", score: 1 },
          { playerId: "bea", score: 2 },
          { playerId: "caio", score: 3 },
        ]),
      ),
    ).toThrow(GameRuleError);
  });

  it("refuses a player who is not in the game", () => {
    expect(() =>
      generic.reduce(
        start(),
        setResults([
          { playerId: "ana", score: 10 },
          { playerId: "bea", score: 8 },
          { playerId: "caio", score: 5 },
          { playerId: "gatecrasher", score: 99 },
        ]),
      ),
    ).toThrow(/not in this game/);
  });

  it("refuses two scores for the same player", () => {
    expect(() =>
      generic.reduce(
        start(),
        setResults([
          { playerId: "ana", score: 10 },
          { playerId: "ana", score: 11 },
          { playerId: "bea", score: 8 },
          { playerId: "caio", score: 5 },
        ]),
      ),
    ).toThrow(/two scores/);
  });

  it("refuses a partial result", () => {
    expect(() =>
      generic.reduce(
        start(),
        setResults([
          { playerId: "ana", score: 10 },
          { playerId: "bea", score: 8 },
        ]),
      ),
    ).toThrow(/no score recorded for caio/);
  });

  it.each([
    ["an unknown action type", { type: "nextRound", entries: [] }],
    ["a missing entries array", { type: "setResults" }],
    ["an empty entries array", { type: "setResults", entries: [] }],
    [
      "a non-numeric score",
      { type: "setResults", entries: [{ playerId: "ana", score: "ten" }] },
    ],
    ["NaN", { type: "setResults", entries: [{ playerId: "ana", score: Number.NaN }] }],
    [
      "Infinity",
      {
        type: "setResults",
        entries: [{ playerId: "ana", score: Number.POSITIVE_INFINITY }],
      },
    ],
    ["an empty player id", { type: "setResults", entries: [{ playerId: "", score: 1 }] }],
    ["not an object at all", "setResults"],
    ["null", null],
  ])("rejects %s", (_label, action) => {
    expect(() => generic.reduce(start(), asAction(action))).toThrow(GameRuleError);
  });
});

describe("generic results", () => {
  const resultsFor = (
    scores: Record<string, number>,
    config: Partial<GenericConfig> = {},
  ) =>
    generic.results(
      generic.reduce(
        start(config),
        setResults(
          Object.entries(scores).map(([playerId, score]) => ({ playerId, score })),
        ),
      ),
    );

  it("places the highest score first when higher is better", () => {
    expect(resultsFor({ ana: 10, bea: 8, caio: 5 })).toEqual([
      { playerId: "ana", score: 10, placement: 1 },
      { playerId: "bea", score: 8, placement: 2 },
      { playerId: "caio", score: 5, placement: 3 },
    ]);
  });

  it("places the lowest score first when lower is better", () => {
    // A golf-shaped game: fewest strokes wins.
    expect(
      resultsFor({ ana: 10, bea: 8, caio: 5 }, { higherIsBetter: false }).map(
        (r) => r.playerId,
      ),
    ).toEqual(["caio", "bea", "ana"]);
  });

  it("shares a placement across a tie", () => {
    expect(resultsFor({ ana: 8, bea: 8, caio: 5 }).map((r) => r.placement)).toEqual([
      1, 1, 3,
    ]);
  });

  it("refuses to produce results before the scores are in", () => {
    expect(() => generic.results(start())).toThrow(GameRuleError);
  });
});
