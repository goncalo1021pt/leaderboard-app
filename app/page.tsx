import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonClasses } from "@/components/ui/button-classes";
import { Card, Page } from "@/components/ui/card";
import { getSignedIn } from "@/lib/auth/server";
import { listMyLeagues } from "@/lib/db/leagues";

import { CreateLeagueForm, EnterCodeForm } from "./leagues/forms";
import { SignOutButton } from "./sign-out";

export default async function HomePage() {
  const signedIn = await getSignedIn();

  if (signedIn === null) {
    return (
      <Page>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="text-muted">
            Record the games your group plays and keep the league standings.
          </p>
          <Link href="/login" className={buttonClasses("primary", "mt-4")}>
            Sign in
          </Link>
        </div>
      </Page>
    );
  }
  if (signedIn.user.name.trim() === "") redirect("/welcome");

  const leagues = await listMyLeagues(signedIn.actor);

  return (
    <Page>
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi, {signedIn.user.name}
        </h1>
        <SignOutButton />
      </header>

      {leagues.length > 0 && (
        <Card title="Your leagues">
          <ul className="divide-border -my-2 flex flex-col divide-y">
            {leagues.map((league) => (
              <li key={league.id}>
                <Link
                  href={`/leagues/${league.id}`}
                  className="flex min-h-12 items-center justify-between py-2"
                >
                  <span className="font-medium">{league.name}</span>
                  {league.role === "owner" && (
                    <span className="text-muted text-sm">Owner</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={leagues.length > 0 ? "Start another league" : "Start a league"}>
        <CreateLeagueForm />
      </Card>

      <Card title="Got an invite?">
        <EnterCodeForm />
      </Card>
    </Page>
  );
}
