import { redirect } from "next/navigation";

import { FormMessage, Page } from "@/components/ui/card";
import { getSignedIn, safeNext } from "@/lib/auth/server";

import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Leaderboard" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if ((await getSignedIn()) !== null) redirect(next);

  return (
    <Page>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted">No password: we email you a link.</p>
      </header>
      <FormMessage
        error={
          params.error !== undefined
            ? "That link has expired or was already used. Ask for a new one."
            : undefined
        }
      />
      <LoginForm
        next={next}
        mailpitUrl={
          process.env.NODE_ENV === "development" ? "http://localhost:8025" : undefined
        }
      />
    </Page>
  );
}
