import { getAuth } from "@/lib/auth/server";

// Better Auth's own endpoints: sending and verifying magic links, sessions,
// sign-out. Resolved per request so the instance is created lazily.
export function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export function POST(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
