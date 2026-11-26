"use client";

import { useActionState, useState } from "react";

import { buttonClasses } from "@/components/ui/button-classes";

import { SubmitButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

import { createPresetAction, publishResultsAction } from "./actions";

interface Player {
  id: string;
  displayName: string;
  isMe: boolean;
}

/** yyyy-mm-dd in the phone's own time zone, for the date picker. */
function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function ResultsForm({
  gameId,
  leagueId,
  presetId,
  scoreLabel,
  higherIsBetter,
  players,
}: {
  /**
   * Made on the server for this page view. Resubmitting the same form after a
   * dropped connection reuses it, and the server publishes the game once.
   */
  gameId: string;
  leagueId: string;
  presetId: string;
  scoreLabel: string;
  higherIsBetter: boolean;
  players: Player[];
}) {
  const [state, action] = useActionState(publishResultsAction, {});
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(players.filter((p) => p.isMe).map((p) => p.id)),
  );
  // null means "just now". Dates are only worked out once someone asks for
  // the picker, in the browser: the server's clock and time zone aren't the
  // phone's, and computing "today" during render would differ between them.
  const [playedOn, setPlayedOn] = useState<string | null>(null);
  const playedAt =
    playedOn === null ? "" : new Date(`${playedOn}T20:00:00`).toISOString();

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="presetId" value={presetId} />
      <input type="hidden" name="gameId" value={gameId} />
      <input type="hidden" name="playedAt" value={playedAt} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          Who played? Then enter {scoreLabel.toLowerCase()}{" "}
          <span className="text-muted">
            ({higherIsBetter ? "highest" : "lowest"} wins)
          </span>
        </legend>
        {players.map((player) => {
          const on = selected.has(player.id);
          return (
            <div
              key={player.id}
              className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 ${on ? "border-foreground" : "border-border"}`}
            >
              <label className="flex flex-1 items-center gap-3 py-3">
                <input
                  type="checkbox"
                  name="player"
                  value={player.id}
                  checked={on}
                  onChange={() => toggle(player.id)}
                  className="size-5 accent-current"
                />
                <span className="font-medium">{player.displayName}</span>
              </label>
              {on && (
                <input
                  name={`score-${player.id}`}
                  aria-label={`${scoreLabel} for ${player.displayName}`}
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  className="border-border bg-background focus:border-foreground h-11 w-24 rounded-lg border px-3 text-right text-base tabular-nums outline-none"
                />
              )}
            </div>
          );
        })}
      </fieldset>

      {playedOn === null ? (
        <button
          type="button"
          onClick={() => setPlayedOn(localDate(new Date()))}
          className={buttonClasses("ghost", "h-auto self-start px-0 text-sm")}
        >
          Played on another day?
        </button>
      ) : (
        <Field
          label="Played on"
          type="date"
          value={playedOn}
          max={localDate(new Date())}
          onChange={(event) => setPlayedOn(event.target.value || null)}
        />
      )}

      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Publishing…" disabled={selected.size < 2}>
        {selected.size < 2
          ? "Pick at least two players"
          : `Publish ${selected.size}-player game`}
      </SubmitButton>
    </form>
  );
}

export function NewPresetForm({ leagueId }: { leagueId: string }) {
  const [state, action] = useActionState(createPresetAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="leagueId" value={leagueId} />
      <Field label="Name" name="name" maxLength={60} required placeholder="Darts" />
      <Field
        label="What does the score count?"
        name="scoreLabel"
        maxLength={30}
        required
        placeholder="Points"
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Who wins?</legend>
        <label className="flex items-center gap-3">
          <input
            type="radio"
            name="direction"
            value="higher"
            defaultChecked
            className="size-5"
          />
          Highest score
        </label>
        <label className="flex items-center gap-3">
          <input type="radio" name="direction" value="lower" className="size-5" />
          Lowest score (golf, darts countdown…)
        </label>
      </fieldset>
      <FormMessage error={state.error} />
      <SubmitButton variant="secondary" pendingLabel="Adding…">
        Add game type
      </SubmitButton>
    </form>
  );
}
