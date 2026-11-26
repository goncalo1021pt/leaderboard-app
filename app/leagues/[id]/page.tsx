import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClasses } from "@/components/ui/button-classes";
import { Card, Page } from "@/components/ui/card";
import { requireSignedIn } from "@/lib/auth/server";
import { NotFoundError } from "@/lib/db/errors";
import { listGames } from "@/lib/db/games";
import { getLeague } from "@/lib/db/leagues";
import { listPlayers } from "@/lib/db/players";

import { AddGuestForm, InviteCard, WhoAreYou } from "../forms";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

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
  const [players, games] = await Promise.all([
    listPlayers(actor, id),
    listGames(actor, id, { limit: 10 }),
  ]);
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

      <Link href={`/leagues/${league.id}/record`} className={buttonClasses("primary")}>
        Record a game
      </Link>

      <Card title="Recent games">
        {games.length === 0 ? (
          <p className="text-muted text-sm">No games yet. Record the first one.</p>
        ) : (
          <ul className="divide-border -my-2 flex flex-col divide-y">
            {games.map((game) => (
              <li key={game.id}>
                <Link
                  href={`/games/${game.id}`}
                  className="flex min-h-14 flex-col justify-center py-2"
                >
                  <span className="flex justify-between gap-3">
                    <span className="font-medium">{game.presetName}</span>
                    <span className="text-muted text-sm">
                      {dateFormat.format(game.playedAt)}
                    </span>
                  </span>
                  <span className="text-muted text-sm">
                    {game.winners.join(" & ")} won · {game.playerCount} players
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted text-sm">
          The standings table arrives in the next step.
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
