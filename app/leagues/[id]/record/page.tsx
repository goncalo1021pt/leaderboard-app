import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Page } from "@/components/ui/card";
import { requireSignedIn } from "@/lib/auth/server";
import { NotFoundError } from "@/lib/db/errors";
import { getLeague } from "@/lib/db/leagues";
import { listPlayers } from "@/lib/db/players";
import { getPreset, listPresets } from "@/lib/db/presets";
import { genericConfigSchema } from "@/lib/games/generic/module";

import { NewPresetForm, ResultsForm } from "./forms";

export const metadata = { title: "Record a game · Leaderboard" };

export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preset?: string }>;
}) {
  const { id } = await params;
  const { preset: presetId } = await searchParams;
  const { actor } = await requireSignedIn(`/leagues/${id}/record`);

  let league;
  try {
    league = await getLeague(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const preset = presetId === undefined ? null : await getPreset(actor, id, presetId);

  // Step two: the results form for the chosen game type.
  if (preset !== null) {
    // Only result-only (generic) games can be entered here; round-based
    // modules get their own live screen (step 9).
    const config = genericConfigSchema.safeParse(preset.config);
    if (preset.moduleId !== "generic" || !config.success) notFound();
    const players = await listPlayers(actor, id);

    return (
      <Page>
        <header className="flex flex-col gap-1">
          <Link href={`/leagues/${id}/record`} className="text-muted text-sm">
            ← Pick another game
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{preset.name}</h1>
          <p className="text-muted text-sm">{league.name}</p>
        </header>
        {players.length < 2 ? (
          <Card>
            <p className="text-muted">
              A game needs at least two players. Add guests on the{" "}
              <Link href={`/leagues/${id}`} className="underline">
                league page
              </Link>{" "}
              first.
            </p>
          </Card>
        ) : (
          <ResultsForm
            gameId={randomUUID()}
            leagueId={id}
            presetId={preset.id}
            scoreLabel={config.data.scoreLabel}
            higherIsBetter={config.data.higherIsBetter}
            players={players.map((p) => ({
              id: p.id,
              displayName: p.displayName,
              isMe: p.userId === actor.userId,
            }))}
          />
        )}
      </Page>
    );
  }

  // Step one: pick what was played.
  const presets = await listPresets(actor, id);
  return (
    <Page>
      <header className="flex flex-col gap-1">
        <Link href={`/leagues/${id}`} className="text-muted text-sm">
          ← {league.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">What did you play?</h1>
      </header>
      <nav className="flex flex-col gap-2">
        {presets.map((p) => (
          <Link
            key={p.id}
            href={`/leagues/${id}/record?preset=${p.id}`}
            className="border-border hover:bg-surface flex min-h-14 items-center justify-between rounded-xl border px-4"
          >
            <span className="font-medium">{p.name}</span>
            {!p.builtIn && <span className="text-muted text-sm">Custom</span>}
          </Link>
        ))}
      </nav>
      <Card title="Something else?">
        <NewPresetForm leagueId={id} />
      </Card>
    </Page>
  );
}
