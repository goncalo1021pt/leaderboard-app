import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/lib/db/client";
import { createLeague } from "@/lib/db/leagues";
import { games, players } from "@/lib/db/schema";

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
    const ana = await createUser("Ana");
    const league = await createLeague(ana, { name: "Games" });
    const [me] = await getDb()
      .select()
      .from(players)
      .where(eq(players.leagueId, league.id));

    const game = {
      leagueId: league.id,
      presetId: "00000000-0000-4000-8000-000000000001",
      moduleId: "generic",
      moduleVersion: 1,
      recordedBy: ana.userId,
      config: {},
      playerIds: [me!.id],
    };

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
