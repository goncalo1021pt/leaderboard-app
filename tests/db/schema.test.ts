import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/lib/db/client";
import { createLeague } from "@/lib/db/leagues";
import { addGuestPlayer } from "@/lib/db/players";
import { gamePresets, gameResults, games, players, seasons } from "@/lib/db/schema";

import { createUser } from "./helpers";

/*
 * The rules the database enforces on its own, underneath the data-access
 * layer. Postgres reports a violation as a DrizzleQueryError whose cause
 * carries the constraint name.
 */
async function violation(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    return cause?.constraint_name;
  }
  throw new Error("expected the database to reject this");
}

const CATAN = "00000000-0000-4000-8000-000000000001";

/** A league with its owner's player and one guest, ready to record a game. */
async function leagueWithPlayers(owner: string) {
  const actor = await createUser(owner);
  const league = await createLeague(actor, { name: `${owner}'s` });
  const [me] = await getDb()
    .select()
    .from(players)
    .where(eq(players.leagueId, league.id));
  const guest = await addGuestPlayer(actor, league.id, { displayName: "Guest" });
  return { actor, league, playerIds: [me!.id, guest.id] };
}

function gameIn(l: Awaited<ReturnType<typeof leagueWithPlayers>>) {
  return {
    leagueId: l.league.id,
    presetId: CATAN,
    moduleId: "generic",
    moduleVersion: 1,
    recordedBy: l.actor.userId,
    config: {},
    playerIds: l.playerIds,
  };
}

describe("schema constraints", () => {
  it("links a user to at most one player per league", async () => {
    const ana = await createUser("Ana");
    const league = await createLeague(ana, { name: "One of me" });

    expect(
      await violation(
        getDb()
          .insert(players)
          .values({ leagueId: league.id, displayName: "Ana again", userId: ana.userId }),
      ),
    ).toBe("players_league_id_user_id_index");
  });

  it("keeps published_at in step with status", async () => {
    const ana = await leagueWithPlayers("Ana");
    const game = gameIn(ana);

    expect(
      await violation(
        getDb()
          .insert(games)
          .values({ ...game, status: "published" }),
      ),
    ).toBe("games_published_at_matches_status");
    expect(
      await violation(
        getDb()
          .insert(games)
          .values({ ...game, publishedAt: new Date() }),
      ),
    ).toBe("games_published_at_matches_status");
    expect(
      await violation(
        getDb()
          .insert(games)
          .values({ ...game, playerIds: [] }),
      ),
    ).toBe("games_has_players");
  });
});

describe("a game stays inside its league", () => {
  it("accepts its own players with a built-in or its own preset", async () => {
    const ana = await leagueWithPlayers("Ana");
    const [own] = await getDb()
      .insert(gamePresets)
      .values({
        leagueId: ana.league.id,
        name: "Darts",
        moduleId: "generic",
        config: { scoreLabel: "Points", higherIsBetter: true },
      })
      .returning();

    await getDb().insert(games).values(gameIn(ana));
    await getDb()
      .insert(games)
      .values({ ...gameIn(ana), presetId: own!.id });
  });

  it("refuses a player from another league", async () => {
    const ana = await leagueWithPlayers("Ana");
    const bruno = await leagueWithPlayers("Bruno");

    expect(
      await violation(
        getDb()
          .insert(games)
          .values({
            ...gameIn(ana),
            playerIds: [ana.playerIds[0]!, bruno.playerIds[0]!],
          }),
      ),
    ).toBe("games_players_same_league");
  });

  it("refuses the same change made later by an update", async () => {
    const ana = await leagueWithPlayers("Ana");
    const bruno = await leagueWithPlayers("Bruno");
    const [game] = await getDb().insert(games).values(gameIn(ana)).returning();

    expect(
      await violation(
        getDb()
          .update(games)
          .set({ playerIds: [...ana.playerIds, bruno.playerIds[0]!] })
          .where(eq(games.id, game!.id)),
      ),
    ).toBe("games_players_same_league");
  });

  it("refuses a player listed twice", async () => {
    const ana = await leagueWithPlayers("Ana");
    expect(
      await violation(
        getDb()
          .insert(games)
          .values({ ...gameIn(ana), playerIds: [ana.playerIds[0]!, ana.playerIds[0]!] }),
      ),
    ).toBe("games_players_distinct");
  });

  it("refuses another league's private preset", async () => {
    const ana = await leagueWithPlayers("Ana");
    const bruno = await leagueWithPlayers("Bruno");
    const [brunos] = await getDb()
      .insert(gamePresets)
      .values({
        leagueId: bruno.league.id,
        name: "Bruno's darts",
        moduleId: "generic",
        config: { scoreLabel: "Points", higherIsBetter: true },
      })
      .returning();

    expect(
      await violation(
        getDb()
          .insert(games)
          .values({ ...gameIn(ana), presetId: brunos!.id }),
      ),
    ).toBe("games_preset_same_league");
  });

  it("refuses another league's season", async () => {
    const ana = await leagueWithPlayers("Ana");
    const bruno = await leagueWithPlayers("Bruno");
    const [brunos] = await getDb()
      .insert(seasons)
      .values({ leagueId: bruno.league.id, name: "Spring", startsAt: new Date() })
      .returning();

    expect(
      await violation(
        getDb()
          .insert(games)
          .values({ ...gameIn(ana), seasonId: brunos!.id }),
      ),
    ).toBe("games_season_same_league");
  });
});

describe("a published result stays inside its league", () => {
  async function publishedGame() {
    const ana = await leagueWithPlayers("Ana");
    const bruno = await leagueWithPlayers("Bruno");
    const [game] = await getDb().insert(games).values(gameIn(ana)).returning();
    return { ana, bruno, gameId: game!.id };
  }

  it("accepts a result for one of the game's own league's players", async () => {
    const { ana, gameId } = await publishedGame();
    await getDb().insert(gameResults).values({
      gameId,
      leagueId: ana.league.id,
      playerId: ana.playerIds[0]!,
      score: 10,
      placement: 1,
    });
  });

  it("refuses another league's player", async () => {
    const { ana, bruno, gameId } = await publishedGame();
    expect(
      await violation(
        getDb().insert(gameResults).values({
          gameId,
          leagueId: ana.league.id,
          playerId: bruno.playerIds[0]!,
          score: 10,
          placement: 1,
        }),
      ),
    ).toBe("game_results_player_same_league_fk");
  });

  it("refuses a row that claims the player's league instead of the game's", async () => {
    const { bruno, gameId } = await publishedGame();
    expect(
      await violation(
        getDb().insert(gameResults).values({
          gameId,
          leagueId: bruno.league.id,
          playerId: bruno.playerIds[0]!,
          score: 10,
          placement: 1,
        }),
      ),
    ).toBe("game_results_game_same_league_fk");
  });
});
