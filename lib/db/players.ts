import { asc, eq } from "drizzle-orm";

import { type Actor, requireMember } from "./access";
import { getDb } from "./client";
import { displayNameSchema } from "./inputs";
import { players } from "./schema";

export interface Player {
  id: string;
  displayName: string;
  /** Null for a guest. */
  userId: string | null;
}

const columns = {
  id: players.id,
  displayName: players.displayName,
  userId: players.userId,
};

export async function listPlayers(actor: Actor, leagueId: string): Promise<Player[]> {
  const db = getDb();
  await requireMember(db, actor, leagueId);
  return db
    .select(columns)
    .from(players)
    .where(eq(players.leagueId, leagueId))
    .orderBy(asc(players.displayName), asc(players.id));
}

/** Handout §8, flow 3. Any member may add a guest; it's how games get recorded. */
export async function addGuestPlayer(
  actor: Actor,
  leagueId: string,
  input: { displayName: string },
): Promise<Player> {
  const displayName = displayNameSchema.parse(input.displayName);
  const db = getDb();
  await requireMember(db, actor, leagueId);
  const [player] = await db
    .insert(players)
    .values({ leagueId, displayName })
    .returning(columns);
  if (player === undefined) throw new Error("insert returned nothing");
  return player;
}
