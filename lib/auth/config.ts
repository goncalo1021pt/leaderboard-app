import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";

import type { Database } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export interface AuthDependencies {
  readonly db: Database;
  /** Public origin of the app, e.g. https://leaderboard.example.com */
  readonly baseURL: string;
  /** Signs session cookies. 32+ random characters; never the dev value. */
  readonly secret: string;
  readonly sendMagicLink: (message: { email: string; url: string }) => Promise<void>;
}

/** Magic links are single-use and short-lived: long enough to switch apps. */
export const MAGIC_LINK_TTL_SECONDS = 15 * 60;

/**
 * Builds the Better Auth instance. A factory rather than a module-level
 * singleton so the integration tests can run the real sign-in flow against the
 * test database with a captured mailbox.
 */
export function createAuth(deps: AuthDependencies) {
  return betterAuth({
    appName: "Leaderboard",
    baseURL: deps.baseURL,
    secret: deps.secret,
    database: drizzleAdapter(deps.db, {
      provider: "pg",
      // Our tables are users/sessions/accounts/verifications (lib/db/schema/auth.ts).
      usePlural: true,
      schema,
    }),
    // Phones stay signed in across game nights; a session quietly renews
    // itself once a day while in use.
    session: {
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24,
    },
    // Magic link only (handout §5). No passwords to store or reset.
    emailAndPassword: { enabled: false },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_TTL_SECONDS,
        // A leaked database dump must not hand out live login links.
        storeToken: "hashed",
        sendMagicLink: ({ email, url }) => deps.sendMagicLink({ email, url }),
      }),
      // Lets server actions that call auth.api set cookies. Must be last.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
