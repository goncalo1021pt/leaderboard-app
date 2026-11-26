import path from "node:path";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client";

/** Where drizzle-kit writes migrations, and where the image copies them. */
export const migrationsFolder = path.join(process.cwd(), "drizzle");

/**
 * Applies every pending migration. Drizzle records applied ones in
 * drizzle.__drizzle_migrations, so this is safe to run on every start.
 */
export async function runMigrations(url: string): Promise<void> {
  const db = createDatabase(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await db.$client.end();
  }
}
