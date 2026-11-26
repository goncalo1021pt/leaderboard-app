import { redirect } from "next/navigation";

import { Page } from "@/components/ui/card";
import { getSignedIn, safeNext } from "@/lib/auth/server";

import { NameForm } from "./name-form";

export const metadata = { title: "Welcome · Leaderboard" };

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const signedIn = await getSignedIn();
  if (signedIn === null) redirect(`/login?next=${encodeURIComponent(next)}`);

  return (
    <Page>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
        <p className="text-muted">One thing before you start.</p>
      </header>
      <NameForm next={next} current={signedIn.user.name} />
    </Page>
  );
}
