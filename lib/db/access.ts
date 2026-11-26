import { and, eq } from "drizzle-orm";

import type { Executor } from "./client";
import { ForbiddenError, NotFoundError } from "./errors";
import { idSchema } from "./inputs";
import { leagueMembers } from "./schema";

/**
 * Who is asking. Built from the session by the caller (step 5), never from
 * anything the browser sends, and passed explicitly to every data-access
 * function that touches league data.
 */
export interface Actor {
  readonly userId: string;
}

export type Role = (typeof leagueMembers.$inferSelect)["role"];

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
    .select({ role: leagueMembers.role })
    .from(leagueMembers)
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
