import { randomUUID } from "node:crypto";

import type { Actor } from "@/lib/db/access";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

/**
 * A user as Better Auth would create one. Every test makes its own, with a
 * unique email, so test files can share one database and run in parallel
 * without cleaning up after each other.
 */
export async function createUser(name: string): Promise<Actor> {
  const id = randomUUID();
  await getDb()
    .insert(users)
    .values({ id, name, email: `${id}@test.invalid`, emailVerified: true });
  return { userId: id };
}
