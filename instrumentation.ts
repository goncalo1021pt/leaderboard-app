/**
 * Runs once when the Next.js server starts. Applies pending migrations before
 * the first request, so deploying a new image is the whole upgrade: there is
 * no separate migrate step to forget on the homelab.
 *
 * The work lives in instrumentation-node.ts, imported only on the Node.js
 * runtime: Next also compiles this file for the Edge runtime, which has no
 * process.exit and no Postgres driver.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
