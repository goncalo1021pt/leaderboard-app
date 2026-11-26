import { asc, eq } from "drizzle-orm";

import { type Actor, type Role, requireMember } from "./access";
import { getDb } from "./client";
import { NotFoundError } from "./errors";
import { leagueNameSchema } from "./inputs";
import { generateInviteCode, normalizeInviteCode } from "./invite-code";
import { leagueMembers, leagues, players, users } from "./schema";

export interface LeagueSummary {
  id: string;
  name: string;
  role: Role;
}

export interface League extends LeagueSummary {
  inviteCode: string;
  scoringMethod: (typeof leagues.$inferSelect)["scoringMethod"];
  createdAt: Date;
}

/**
 * Handout §8, flow 1: the creator becomes the owner, a member, and a player
 * named after them, all or nothing.
 */
export async function createLeague(
  actor: Actor,
  input: { name: string },
): Promise<League> {
  const name = leagueNameSchema.parse(input.name);

  return getDb().transaction(async (tx) => {
    const [user] = await tx
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, actor.userId));
    if (user === undefined) {
      throw new NotFoundError("User not found");
    }

    // A collision among 2^50 codes is not worth a retry loop: the unique
    // constraint turns the one-in-a-quadrillion case into an error, not a
    // shared league.
    const [league] = await tx
      .insert(leagues)
      .values({ name, ownerId: actor.userId, inviteCode: generateInviteCode() })
      .returning();
    if (league === undefined) throw new Error("insert returned nothing");

    await tx.insert(leagueMembers).values({
      leagueId: league.id,
      userId: actor.userId,
      role: "owner",
    });
    await tx.insert(players).values({
      leagueId: league.id,
      displayName: user.name,
      userId: actor.userId,
    });

    return {
      id: league.id,
      name: league.name,
      role: "owner",
      inviteCode: league.inviteCode,
      scoringMethod: league.scoringMethod,
      createdAt: league.createdAt,
    };
  });
}

/** Every league the actor belongs to. */
export async function listMyLeagues(actor: Actor): Promise<LeagueSummary[]> {
  return getDb()
    .select({ id: leagues.id, name: leagues.name, role: leagueMembers.role })
    .from(leagueMembers)
    .innerJoin(leagues, eq(leagues.id, leagueMembers.leagueId))
    .where(eq(leagueMembers.userId, actor.userId))
    .orderBy(asc(leagues.name), asc(leagues.id));
}

export async function getLeague(actor: Actor, leagueId: string): Promise<League> {
  const db = getDb();
  const role = await requireMember(db, actor, leagueId);
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId));
  if (league === undefined) throw new NotFoundError("League not found");
  return {
    id: league.id,
    name: league.name,
    role,
    inviteCode: league.inviteCode,
    scoringMethod: league.scoringMethod,
    createdAt: league.createdAt,
  };
}

/**
 * Handout §8, flow 2, first half: become a member. Joining a league you are
 * already in is a no-op rather than an error, so a double-tapped button or a
 * reused link does no harm. Linking to a player is a separate step.
 */
export async function joinLeagueByCode(
  actor: Actor,
  code: string,
): Promise<{ leagueId: string; alreadyMember: boolean }> {
  const inviteCode = normalizeInviteCode(code);

  return getDb().transaction(async (tx) => {
    const [league] = await tx
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.inviteCode, inviteCode));
    if (league === undefined) {
      throw new NotFoundError("No league has that invite code");
    }

    const inserted = await tx
      .insert(leagueMembers)
      .values({ leagueId: league.id, userId: actor.userId, role: "member" })
      .onConflictDoNothing()
      .returning({ leagueId: leagueMembers.leagueId });

    return { leagueId: league.id, alreadyMember: inserted.length === 0 };
  });
}
