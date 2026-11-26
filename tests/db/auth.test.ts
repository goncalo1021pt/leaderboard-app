import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createAuth } from "@/lib/auth/config";
import { getDb } from "@/lib/db/client";
import { users, verifications } from "@/lib/db/schema";

/*
 * Better Auth's real magic-link flow against the real schema. This is what
 * proves lib/db/schema/auth.ts matches what Better Auth expects: any column it
 * can't find, or finds with the wrong name, fails here.
 */

function authWithMailbox() {
  const sent: { email: string; url: string }[] = [];
  const auth = createAuth({
    db: getDb(),
    baseURL: "http://localhost:3000",
    secret: "test-secret-test-secret-test-secret-0123",
    sendMagicLink: async (message) => {
      sent.push(message);
    },
  });
  return { auth, sent };
}

async function requestLink(email: string) {
  const { auth, sent } = authWithMailbox();
  await auth.api.signInMagicLink({
    body: { email, callbackURL: "/", newUserCallbackURL: "/welcome" },
    headers: new Headers(),
  });
  expect(sent).toHaveLength(1);
  const url = new URL(sent[0]!.url);
  return { auth, url, token: url.searchParams.get("token")! };
}

async function followLink(email: string) {
  const { auth, url, token } = await requestLink(email);
  const response = await auth.api.magicLinkVerify({
    query: {
      token,
      callbackURL: url.searchParams.get("callbackURL") ?? "/",
      newUserCallbackURL: url.searchParams.get("newUserCallbackURL") ?? undefined,
    },
    headers: new Headers(),
    asResponse: true,
  });
  return { auth, token, response };
}

function cookieHeader(response: Response): Headers {
  const cookies = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie: cookies });
}

describe("magic-link sign-in", () => {
  it("emails a link to the verify endpoint, storing only a hash of the token", async () => {
    const email = `${randomUUID()}@test.invalid`;
    const { url, token } = await requestLink(email);

    expect(url.origin + url.pathname).toBe(
      "http://localhost:3000/api/auth/magic-link/verify",
    );
    expect(token.length).toBeGreaterThan(20);

    const stored = await getDb().select().from(verifications);
    expect(stored.some((row) => row.identifier === token)).toBe(false);
  });

  it("signs a new user up, sends them to /welcome, and starts a session", async () => {
    const email = `${randomUUID()}@test.invalid`;
    const { auth, response } = await followLink(email);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3000/welcome");

    const [user] = await getDb().select().from(users).where(eq(users.email, email));
    expect(user).toMatchObject({ email, name: "", emailVerified: true });

    const session = await auth.api.getSession({ headers: cookieHeader(response) });
    expect(session?.user.email).toBe(email);
  });

  it("sends a returning user to the callback, not /welcome", async () => {
    const email = `${randomUUID()}@test.invalid`;
    await followLink(email);
    const { response } = await followLink(email);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("refuses a link the second time it is used", async () => {
    const email = `${randomUUID()}@test.invalid`;
    const { auth, token } = await followLink(email);
    const again = await auth.api.magicLinkVerify({
      query: { token, callbackURL: "/" },
      headers: new Headers(),
      asResponse: true,
    });
    expect(
      again.headers
        .getSetCookie()
        .some((c) => c.includes("session_token=") && !c.includes("Max-Age=0")),
    ).toBe(false);
    expect(again.headers.get("location")).toContain("error=");
  });

  it("lets a signed-in user set their name", async () => {
    const email = `${randomUUID()}@test.invalid`;
    const { auth, response } = await followLink(email);
    await auth.api.updateUser({ body: { name: "Ana" }, headers: cookieHeader(response) });
    const [user] = await getDb().select().from(users).where(eq(users.email, email));
    expect(user?.name).toBe("Ana");
  });
});
