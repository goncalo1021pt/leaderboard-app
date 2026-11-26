import { and, asc, eq, isNull } from "drizzle-orm";

import { type Actor, requireMember } from "./access";
import { getDb } from "./client";
import { ForbiddenError, NotFoundError, isUniqueViolation } from "./errors";
import { displayNameSchema, idSchema } from "./inputs";
import { players, users } from "./schema";

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

/** The player linked to the actor in this league, or null if none yet. */
export async function myPlayer(actor: Actor, leagueId: string): Promise<Player | null> {
  const db = getDb();
  await requireMember(db, actor, leagueId);
  const [player] = await db
    .select(columns)
    .from(players)
    .where(and(eq(players.leagueId, leagueId), eq(players.userId, actor.userId)));
  return player ?? null;
}

const ALREADY_LINKED = "You already have a player in this league";

/** The unique index that allows one linked player per user per league. */
const ONE_PLAYER_PER_USER = "players_league_id_user_id_index";

/**
 * Handout §8, flow 2, second half: someone who joined says "that guest is me",
 * and inherits the guest's games. Only an unlinked guest can be claimed.
 */
export async function claimGuestPlayer(
  actor: Actor,
  leagueId: string,
  playerId: string,
): Promise<Player> {
  const db = getDb();
  await requireMember(db, actor, leagueId);
  if (!idSchema.safeParse(playerId).success) throw new NotFoundError("Player not found");

  try {
    const [claimed] = await db
      .update(players)
      .set({ userId: actor.userId })
      .where(
        and(
          eq(players.id, playerId),
          eq(players.leagueId, leagueId),
          isNull(players.userId),
        ),
      )
      .returning(columns);
    if (claimed === undefined) {
      throw new NotFoundError("That player doesn't exist or is already someone's");
    }
    return claimed;
  } catch (error) {
    if (isUniqueViolation(error, ONE_PLAYER_PER_USER))
      throw new ForbiddenError(ALREADY_LINKED);
    throw error;
  }
}

/** The other branch of flow 2: "I'm new here", a player under the user's name. */
export async function createOwnPlayer(actor: Actor, leagueId: string): Promise<Player> {
  const db = getDb();
  await requireMember(db, actor, leagueId);
  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, actor.userId));
  if (user === undefined) throw new NotFoundError("User not found");

  try {
    const [player] = await db
      .insert(players)
      .values({ leagueId, displayName: user.name, userId: actor.userId })
      .returning(columns);
    if (player === undefined) throw new Error("insert returned nothing");
    return player;
  } catch (error) {
    if (isUniqueViolation(error, ONE_PLAYER_PER_USER))
      throw new ForbiddenError(ALREADY_LINKED);
    throw error;
  }
}
