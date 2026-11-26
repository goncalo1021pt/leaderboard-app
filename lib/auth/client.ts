"use client";

import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The browser side of Better Auth. Requesting a magic link goes through here,
 * not a server action, so the request hits Better Auth's own endpoint and its
 * per-IP rate limit (5 a minute) protects inboxes from someone hammering the
 * form. Same origin, so no baseURL needed.
 */
export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
