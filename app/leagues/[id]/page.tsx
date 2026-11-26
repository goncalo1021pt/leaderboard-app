import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Page } from "@/components/ui/card";
import { requireSignedIn } from "@/lib/auth/server";
import { NotFoundError } from "@/lib/db/errors";
import { getLeague } from "@/lib/db/leagues";
import { listPlayers } from "@/lib/db/players";

import { AddGuestForm, InviteCard, WhoAreYou } from "../forms";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { actor } = await requireSignedIn(`/leagues/${id}`);

  let league;
  try {
    league = await getLeague(actor, id);
  } catch (error) {
    // Missing and not-a-member look the same, on purpose (lib/db/errors.ts).
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const players = await listPlayers(actor, id);
  const me = players.find((p) => p.userId === actor.userId);
  const guests = players.filter((p) => p.userId === null);
  const inviteLink = `${process.env.BETTER_AUTH_URL}/join/${league.inviteCode}`;

  return (
    <Page>
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-muted text-sm">
          ← Your leagues
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{league.name}</h1>
      </header>

      {me === undefined && (
        <Card title="Which player are you?">
          <WhoAreYou leagueId={league.id} guests={guests} />
        </Card>
      )}

      <Card title="Standings">
        <p className="text-muted text-sm">
          Recording games and the standings table arrive in the next steps.
        </p>
      </Card>

      <Card title={`Players (${players.length})`}>
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li key={player.id} className="flex items-center justify-between">
              <span>{player.displayName}</span>
              <span className="text-muted text-sm">
                {player.userId === actor.userId
                  ? "You"
                  : player.userId === null
                    ? "Guest"
                    : ""}
              </span>
            </li>
          ))}
        </ul>
        <AddGuestForm leagueId={league.id} />
      </Card>

      <Card title="Invite friends">
        <InviteCard
          leagueId={league.id}
          code={league.inviteCode}
          link={inviteLink}
          isOwner={league.role === "owner"}
        />
      </Card>
    </Page>
  );
}
