/**
 * Runs once when the Next.js server starts. Applies pending migrations before
 * the first request, so deploying a new image is the whole upgrade: there is
 * no separate migrate step to forget on the homelab.
 *
 * Safe because there is exactly one app instance. Running several would need
 * a lock around this, or a dedicated migrate job.
 *
 * If migrations still fail after retrying, the process exits. A server left
 * running on an unmigrated database would answer every request with a 500 and
 * never try again; exiting makes the failure visible and lets Docker's restart
 * policy start a fresh attempt.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { describeError, migrateWithRetry } = await import("./lib/db/migrate");
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
}
