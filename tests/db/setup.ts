import { afterAll, inject } from "vitest";

import { getDb } from "@/lib/db/client";

// Point every connection this file opens at the scratch database that
// global-setup.ts created, never at the dev one.
process.env.DATABASE_URL = inject("databaseUrl");

// Close this file's pool so the worker can exit, and forget it so the next
// file in the same worker opens a fresh one.
afterAll(async () => {
  await getDb().$client.end();
  delete (globalThis as { leaderboardDb?: unknown }).leaderboardDb;
});
