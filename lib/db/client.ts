import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/*
 * The only module that opens a database connection. ESLint forbids importing
 * it — or drizzle-orm, or postgres — anywhere outside lib/db and lib/auth, so
 * every query goes through the data-access functions next to it, which is
 * where authorization lives (handout §7).
 */

export function createDatabase(url: string) {
  const client = postgres(url, {
    // A friend group's traffic; plenty, and kind to a homelab Postgres.
    max: 10,
    // Silences "NOTICE: relation already exists, skipping" from migrations.
    onnotice: () => {},
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDatabase>;

/** A transaction handle; accepted anywhere a Database is. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type Executor = Database | Transaction;

// Cached on globalThis so dev-mode hot reload does not open a new pool on
// every edit.
const globalForDb = globalThis as { leaderboardDb?: Database };

/**
 * Opened lazily on first use rather than at import, so `next build` — which
 * imports server code but never queries — does not need DATABASE_URL.
 */
export function getDb(): Database {
  if (globalForDb.leaderboardDb === undefined) {
    const url = process.env.DATABASE_URL;
    if (url === undefined || url === "") {
      throw new Error("DATABASE_URL is not set");
    }
    globalForDb.leaderboardDb = createDatabase(url);
  }
  return globalForDb.leaderboardDb;
}
