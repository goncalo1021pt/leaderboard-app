"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSignedIn } from "@/lib/auth/server";
import { publishGame } from "@/lib/db/games";
import { createPreset } from "@/lib/db/presets";
import { type FormState, field, formError } from "@/lib/forms";

const scoreSchema = z
  .string()
  .trim()
  .min(1, "Every player needs a score")
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number({ error: "Scores must be numbers" }).finite("Scores must be numbers"));

const playedAtSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine(
    (date) => date.getTime() <= Date.now() + 60 * 60 * 1000,
    "That date is in the future",
  );

export async function publishResultsAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const leagueId = field(formData, "leagueId");
  const { actor } = await requireSignedIn(`/leagues/${leagueId}/record`);
  let gameId: string;
  try {
    const playerIds = formData.getAll("player").map(String);
    if (playerIds.length < 2) return { error: "Pick at least two players" };
    const entries = playerIds.map((playerId) => ({
      playerId,
      score: scoreSchema.parse(field(formData, `score-${playerId}`)),
    }));
    const playedAt = field(formData, "playedAt");
    gameId = await publishGame(actor, {
      gameId: field(formData, "gameId"),
      leagueId,
      presetId: field(formData, "presetId"),
      playerIds,
      actions: [{ type: "setResults", entries }],
      playedAt: playedAt === "" ? undefined : playedAtSchema.parse(playedAt),
    });
  } catch (error) {
    return formError(error);
  }
  revalidatePath(`/leagues/${leagueId}`);
  redirect(`/games/${gameId}`);
}

export async function createPresetAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const leagueId = field(formData, "leagueId");
  const { actor } = await requireSignedIn(`/leagues/${leagueId}/record`);
  let presetId: string;
  try {
    presetId = (
      await createPreset(actor, leagueId, {
        name: field(formData, "name"),
        scoreLabel: field(formData, "scoreLabel"),
        higherIsBetter: field(formData, "direction") !== "lower",
      })
    ).id;
  } catch (error) {
    return formError(error);
  }
  redirect(`/leagues/${leagueId}/record?preset=${presetId}`);
}
