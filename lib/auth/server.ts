import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { Actor } from "@/lib/db/access";
import { getDb } from "@/lib/db/client";
import { sendMagicLinkEmail } from "@/lib/mail/magic-link";

import { type Auth, createAuth } from "./config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set`);
  }
  return value;
}

const globalForAuth = globalThis as { leaderboardAuth?: Auth };

/** Created on first use, like the database, so `next build` needs no secrets. */
export function getAuth(): Auth {
  if (globalForAuth.leaderboardAuth === undefined) {
    globalForAuth.leaderboardAuth = createAuth({
      db: getDb(),
      baseURL: requireEnv("BETTER_AUTH_URL"),
      secret: requireEnv("BETTER_AUTH_SECRET"),
      sendMagicLink: sendMagicLinkEmail,
    });
  }
  return globalForAuth.leaderboardAuth;
}

export interface SignedIn {
  actor: Actor;
  user: { id: string; name: string; email: string };
}

/** The current session, once per request however many components ask. */
export const getSignedIn = cache(async (): Promise<SignedIn | null> => {
  // headers() first: it is what marks the page dynamic. Calling getAuth()
  // before it makes `next build` try to prerender the page and open a
  // database connection with no DATABASE_URL.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (session === null) return null;
  const { id, name, email } = session.user;
  return { actor: { userId: id }, user: { id, name, email } };
});

/**
 * For pages and actions that need a signed-in user with a name. Sends anyone
 * else to log in (coming back here afterwards) or to pick a name first.
 */
export async function requireSignedIn(returnTo: string): Promise<SignedIn> {
  const signedIn = await getSignedIn();
  if (signedIn === null) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  if (signedIn.user.name.trim() === "") {
    redirect(`/welcome?next=${encodeURIComponent(returnTo)}`);
  }
  return signedIn;
}

/**
 * Only same-site paths survive as a post-login destination, so a crafted
 * `?next=https://evil.example` link can't bounce someone off the site.
 */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback;
  return next;
}
