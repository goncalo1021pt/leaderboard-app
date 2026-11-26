import { and, eq, sql } from "drizzle-orm";

import type { Executor } from "./client";
import { ForbiddenError, NotFoundError } from "./errors";
import { idSchema } from "./inputs";
import { leagueMembers, leagues } from "./schema";

/**
 * Who is asking. Built from the session by the caller (step 5), never from
 * anything the browser sends, and passed explicitly to every data-access
 * function that touches league data.
 */
export interface Actor {
  readonly userId: string;
}

/**
 * Derived, not stored: the owner is whoever leagues.owner_id names, and every
 * other member is a member. One source of truth means the two can't disagree.
 */
export type Role = "owner" | "member";

/** SQL for the actor's role, given a query that joins leagues. */
export function roleOf(actor: Actor) {
  return sql<Role>`case when ${leagues.ownerId} = ${actor.userId} then 'owner' else 'member' end`;
}

/**
 * The actor's role in a league, or throws NotFoundError if they are not a
 * member — including when the league does not exist, or the id is not even a
 * UUID. Every league-scoped function calls this (or requireOwner) first.
 */
export async function requireMember(
  db: Executor,
  actor: Actor,
  leagueId: string,
): Promise<Role> {
  if (!idSchema.safeParse(leagueId).success) {
    throw new NotFoundError("League not found");
  }
  const [row] = await db
    .select({ role: roleOf(actor) })
    .from(leagueMembers)
    .innerJoin(leagues, eq(leagues.id, leagueMembers.leagueId))
    .where(
      and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, actor.userId)),
    );
  if (row === undefined) {
    throw new NotFoundError("League not found");
  }
  return row.role;
}

export async function requireOwner(
  db: Executor,
  actor: Actor,
  leagueId: string,
): Promise<void> {
  const role = await requireMember(db, actor, leagueId);
  if (role !== "owner") {
    throw new ForbiddenError("Only the league owner can do that");
  }
}
