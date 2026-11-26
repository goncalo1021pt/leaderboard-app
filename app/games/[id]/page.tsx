import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClasses } from "@/components/ui/button-classes";
import { Card, Page } from "@/components/ui/card";
import { requireSignedIn } from "@/lib/auth/server";
import { NotFoundError } from "@/lib/db/errors";
import { getGame } from "@/lib/db/games";
import { ordinal } from "@/lib/format";

export const metadata = { title: "Game · Leaderboard" };

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await requireSignedIn(`/games/${id}`);

  let game;
  try {
    game = await getGame(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(
    game.playedAt,
  );
  const tied = (placement: number) =>
    game.results.filter((r) => r.placement === placement).length > 1;

  return (
    <Page>
      <header className="flex flex-col gap-1">
        <Link href={`/leagues/${game.leagueId}`} className="text-muted text-sm">
          ← Back to the league
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{game.presetName}</h1>
        <p className="text-muted text-sm">
          {date} · recorded by {game.recordedByName}
        </p>
      </header>

      <Card>
        <table className="w-full">
          <thead>
            <tr className="text-muted text-left text-sm">
              <th className="pb-2 font-normal">Place</th>
              <th className="pb-2 font-normal">Player</th>
              <th className="pb-2 text-right font-normal">{game.scoreLabel}</th>
            </tr>
          </thead>
          <tbody>
            {game.results.map((result) => (
              <tr key={result.playerId} className="border-border border-t">
                <td className="py-3 tabular-nums">
                  {tied(result.placement) ? "=" : ""}
                  {ordinal(result.placement)}
                </td>
                <td className={`py-3 ${result.placement === 1 ? "font-semibold" : ""}`}>
                  {result.displayName}
                </td>
                <td className="py-3 text-right tabular-nums">{result.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-muted text-sm">
        Published games can&apos;t be corrected yet; that arrives in a later version.
      </p>
      <Link
        href={`/leagues/${game.leagueId}/record`}
        className={buttonClasses("secondary")}
      >
        Record another game
      </Link>
    </Page>
  );
}
