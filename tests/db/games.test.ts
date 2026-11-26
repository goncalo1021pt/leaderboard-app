import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { ForbiddenError, NotFoundError } from "@/lib/db/errors";
import { getGame, listGames, publishGame } from "@/lib/db/games";
import { createLeague, joinLeagueByCode } from "@/lib/db/leagues";
import { addGuestPlayer, myPlayer } from "@/lib/db/players";
import { createPreset, getPreset, listPresets } from "@/lib/db/presets";
import { GameRuleError, GameSetupError } from "@/lib/games/errors";

import { createUser } from "./helpers";

const BOWLING = "00000000-0000-4000-8000-000000000003";

/** A bowling night: Ana (the scorekeeper) and three guests. */
async function bowlingLeague() {
  const ana = await createUser("Ana");
  const league = await createLeague(ana, { name: "Bowling" });
  const me = (await myPlayer(ana, league.id))!;
  const rui = await addGuestPlayer(ana, league.id, { displayName: "Rui" });
  const sara = await addGuestPlayer(ana, league.id, { displayName: "Sara" });
  const tiago = await addGuestPlayer(ana, league.id, { displayName: "Tiago" });
  return {
    ana,
    league,
    ids: { ana: me.id, rui: rui.id, sara: sara.id, tiago: tiago.id },
  };
}

function setResults(scores: Record<string, number>) {
  return [
    {
      type: "setResults",
      entries: Object.entries(scores).map(([playerId, score]) => ({ playerId, score })),
    },
  ];
}

describe("publishGame", () => {
  it("replays the game on the server and stores placements it computed itself", async () => {
    const { ana, league, ids } = await bowlingLeague();
    const gameId = randomUUID();

    await publishGame(ana, {
      gameId,
      leagueId: league.id,
      presetId: BOWLING,
      playerIds: [ids.ana, ids.rui, ids.sara, ids.tiago],
      actions: setResults({
        [ids.ana]: 142,
        [ids.rui]: 168,
        [ids.sara]: 142,
        [ids.tiago]: 97,
      }),
      playedAt: new Date("2026-11-20T21:00:00Z"),
    });

    const game = await getGame(ana, gameId);
    expect(game.presetName).toBe("Bowling");
    expect(game.scoreLabel).toBe("Pins");
    expect(game.recordedByName).toBe("Ana");
    expect(game.playedAt.toISOString()).toBe("2026-11-20T21:00:00.000Z");
    expect(game.results.map((r) => [r.displayName, r.score, r.placement])).toEqual([
      ["Rui", 168, 1],
      ["Ana", 142, 2],
      ["Sara", 142, 2],
      ["Tiago", 97, 4],
    ]);
  });

  it("is idempotent: a retry with the same id publishes once", async () => {
    const { ana, league, ids } = await bowlingLeague();
    const input = {
      gameId: randomUUID(),
      leagueId: league.id,
      presetId: BOWLING,
      playerIds: [ids.ana, ids.rui],
      actions: setResults({ [ids.ana]: 100, [ids.rui]: 90 }),
    };
    await publishGame(ana, input);
    await publishGame(ana, input);
    expect(await listGames(ana, league.id)).toHaveLength(1);
  });

  it("won't let someone else reuse a game id", async () => {
    const { ana, league, ids } = await bowlingLeague();
    const bruno = await createUser("Bruno");
    await joinLeagueByCode(bruno, league.inviteCode);
    const input = {
      gameId: randomUUID(),
      leagueId: league.id,
      presetId: BOWLING,
      playerIds: [ids.ana, ids.rui],
      actions: setResults({ [ids.ana]: 100, [ids.rui]: 90 }),
    };
    await publishGame(ana, input);
    await expect(publishGame(bruno, input)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects an unfinished or malformed game, with the engine's reason", async () => {
    const { ana, league, ids } = await bowlingLeague();
    const base = {
      leagueId: league.id,
      presetId: BOWLING,
      playerIds: [ids.ana, ids.rui],
    };

    await expect(
      publishGame(ana, { ...base, gameId: randomUUID(), actions: [] }),
    ).rejects.toBeInstanceOf(GameRuleError);
    await expect(
      publishGame(ana, {
        ...base,
        gameId: randomUUID(),
        actions: setResults({ [ids.ana]: 100 }),
      }),
    ).rejects.toThrow(/no score recorded/);
    await expect(
      publishGame(ana, {
        ...base,
        gameId: randomUUID(),
        playerIds: [ids.ana],
        actions: setResults({ [ids.ana]: 100 }),
      }),
    ).rejects.toBeInstanceOf(GameSetupError);
    await expect(
      publishGame(ana, { ...base, gameId: "not-a-uuid", actions: [] }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await listGames(ana, league.id)).toEqual([]);
  });

  it("keeps a game inside its league: players, preset and the publisher", async () => {
    const { ana, league, ids } = await bowlingLeague();
    const other = await bowlingLeague();
    const darts = await createPreset(other.ana, other.league.id, {
      name: "Darts",
      scoreLabel: "Points",
      higherIsBetter: true,
    });

    const game = (overrides: object) => ({
      gameId: randomUUID(),
      leagueId: league.id,
      presetId: BOWLING,
      playerIds: [ids.ana, ids.rui],
      actions: setResults({ [ids.ana]: 1, [ids.rui]: 2 }),
      ...overrides,
    });

    await expect(
      publishGame(ana, game({ playerIds: [ids.ana, other.ids.rui] })),
    ).rejects.toThrow("Some of those players aren't in this league");
    await expect(publishGame(ana, game({ presetId: darts.id }))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(publishGame(other.ana, game({}))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("reading games", () => {
  it("lists newest first with the winners, ties included", async () => {
    const { ana, league, ids } = await bowlingLeague();
    for (const [day, scores] of [
      ["2026-11-01", { [ids.ana]: 120, [ids.rui]: 130 }],
      ["2026-11-08", { [ids.ana]: 150, [ids.rui]: 150 }],
    ] as const) {
      await publishGame(ana, {
        gameId: randomUUID(),
        leagueId: league.id,
        presetId: BOWLING,
        playerIds: Object.keys(scores),
        actions: setResults(scores),
        playedAt: new Date(`${day}T21:00:00Z`),
      });
    }
    const games = await listGames(ana, league.id);
    expect(games.map((g) => [g.winners, g.playerCount])).toEqual([
      [["Ana", "Rui"], 2],
      [["Rui"], 2],
    ]);
  });

  it("hides a game from anyone outside its league", async () => {
    const { ana, league, ids } = await bowlingLeague();
    const stranger = await createUser("Stranger");
    const gameId = randomUUID();
    await publishGame(ana, {
      gameId,
      leagueId: league.id,
      presetId: BOWLING,
      playerIds: [ids.ana, ids.rui],
      actions: setResults({ [ids.ana]: 1, [ids.rui]: 2 }),
    });
    await expect(getGame(stranger, gameId)).rejects.toThrow("Game not found");
    await expect(getGame(stranger, randomUUID())).rejects.toThrow("Game not found");
    await expect(listGames(stranger, league.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("custom game types", () => {
  it("score with the league's own rules, lowest first if asked", async () => {
    const { ana, league, ids } = await bowlingLeague();
    const golf = await createPreset(ana, league.id, {
      name: " Mini golf ",
      scoreLabel: "Strokes",
      higherIsBetter: false,
    });
    expect(golf).toMatchObject({ name: "Mini golf", builtIn: false });
    expect((await listPresets(ana, league.id)).at(-1)?.name).toBe("Mini golf");

    const gameId = randomUUID();
    await publishGame(ana, {
      gameId,
      leagueId: league.id,
      presetId: golf.id,
      playerIds: [ids.ana, ids.rui],
      actions: setResults({ [ids.ana]: 41, [ids.rui]: 38 }),
    });
    const game = await getGame(ana, gameId);
    expect(game.scoreLabel).toBe("Strokes");
    expect(game.results[0]).toMatchObject({ displayName: "Rui", placement: 1 });
  });

  it("refuse a name that's taken, built-ins included, whatever the case", async () => {
    const { ana, league } = await bowlingLeague();
    const golf = { scoreLabel: "Strokes", higherIsBetter: false };
    await expect(
      createPreset(ana, league.id, { name: "bowling", ...golf }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await createPreset(ana, league.id, { name: "Golf", ...golf });
    await expect(createPreset(ana, league.id, { name: "GOLF", ...golf })).rejects.toThrow(
      "There's already a game called GOLF",
    );
    await expect(
      createPreset(ana, league.id, {
        name: "Darts",
        scoreLabel: " ",
        higherIsBetter: true,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("belong to their league only", async () => {
    const { ana, league } = await bowlingLeague();
    const other = await bowlingLeague();
    const golf = await createPreset(ana, league.id, {
      name: "Golf",
      scoreLabel: "Strokes",
      higherIsBetter: false,
    });
    expect(await getPreset(other.ana, other.league.id, golf.id)).toBeNull();
    expect(await getPreset(ana, league.id, golf.id)).toMatchObject({ name: "Golf" });
    await expect(getPreset(other.ana, league.id, golf.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
