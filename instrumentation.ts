/**
 * Runs once when the Next.js server starts. Applies pending migrations before
 * the first request, so deploying a new image is the whole upgrade: there is
 * no separate migrate step to forget on the homelab.
 *
 * Safe because there is exactly one app instance. Running several would need
 * a lock around this, or a dedicated migrate job.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error("DATABASE_URL is not set");
  }

  const { runMigrations } = await import("./lib/db/migrate");
  await runMigrations(url);
}
