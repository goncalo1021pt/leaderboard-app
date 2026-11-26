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

export interface RetryOptions {
  /** Give up after this long. Long enough for Postgres to finish booting. */
  readonly deadlineMs?: number;
  readonly run?: () => Promise<void>;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  readonly log?: (message: string) => void;
}

/**
 * runMigrations, retried with capped exponential backoff until it succeeds or
 * the deadline passes, then rethrows the last error.
 *
 * The usual failure is a homelab reboot where the app starts before Postgres
 * accepts connections; retrying rides that out. Anything else (wrong password,
 * a broken migration) fails every attempt and surfaces at the deadline. Every
 * attempt is safe to repeat: drizzle applies pending migrations in a single
 * transaction and skips the ones already recorded.
 */
export async function migrateWithRetry(
  url: string,
  options: RetryOptions = {},
): Promise<void> {
  const {
    deadlineMs = 60_000,
    run = () => runMigrations(url),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
    log = (message) => console.warn(message),
  } = options;

  const giveUpAt = now() + deadlineMs;
  for (let attempt = 1; ; attempt++) {
    try {
      await run();
      return;
    } catch (error) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10_000);
      if (now() + delay > giveUpAt) throw error;
      log(
        `migrations: attempt ${attempt} failed (${describeError(error)}); retrying in ${delay / 1000}s`,
      );
      await sleep(delay);
    }
  }
}

/**
 * Drizzle wraps driver errors in "Failed query: …"; the useful part (refused
 * connection, wrong password) is the cause.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  return cause instanceof Error ? cause.message : error.message;
}
