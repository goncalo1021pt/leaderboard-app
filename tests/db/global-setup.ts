import postgres from "postgres";
import type { TestProject } from "vitest/node";

import { runMigrations } from "@/lib/db/migrate";

const TEST_DATABASE = "leaderboard_test";

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/**
 * Recreates the test database from nothing and applies every migration, so
 * each run also proves the migrations apply cleanly to an empty database —
 * which is exactly what happens on a fresh homelab install.
 */
export default async function setup(project: TestProject): Promise<void> {
  const base = process.env.DATABASE_URL;
  if (base === undefined || base === "") {
    throw new Error("DATABASE_URL is not set; run the tests through `make test`");
  }

  // CREATE/DROP DATABASE cannot run while connected to the target database.
  const admin = postgres(withDatabase(base, "postgres"), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DATABASE} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${TEST_DATABASE}`);
  } finally {
    await admin.end();
  }

  const testUrl = withDatabase(base, TEST_DATABASE);
  await runMigrations(testUrl);

  project.provide("databaseUrl", testUrl);
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
