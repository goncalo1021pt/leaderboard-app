/**
 * Migrations at server start (see instrumentation.ts). Node.js runtime only.
 *
 * Safe because there is exactly one app instance. Running several would need
 * a lock around this, or a dedicated migrate job.
 *
 * If migrations still fail after retrying, the process exits. A server left
 * running on an unmigrated database would answer every request with a 500 and
 * never try again; exiting makes the failure visible and lets Docker's restart
 * policy start a fresh attempt.
 */
import { describeError, migrateWithRetry } from "./lib/db/migrate";

try {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error("DATABASE_URL is not set");
  }
  await migrateWithRetry(url);
} catch (error) {
  console.error(
    `migrations: giving up (${describeError(error)}); exiting so the container restarts`,
  );
  process.exit(1);
}
