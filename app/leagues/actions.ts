"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/server";
import { createLeague, joinLeagueByCode, rotateInviteCode } from "@/lib/db/leagues";
import { normalizeInviteCode } from "@/lib/db/invite-code";
import { addGuestPlayer, claimGuestPlayer, createOwnPlayer } from "@/lib/db/players";
import { type FormState, field, formError } from "@/lib/forms";

/*
 * Server actions are public HTTP endpoints, whatever page renders them. Each
 * one resolves the actor from the session itself and leaves every access check
 * to lib/db; nothing here trusts an id from the form beyond passing it along.
 */

export async function createLeagueAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor } = await requireSignedIn("/");
  let leagueId: string;
  try {
    leagueId = (await createLeague(actor, { name: field(formData, "name") })).id;
  } catch (error) {
    return formError(error);
  }
  redirect(`/leagues/${leagueId}`);
}

/** The "I have a code" form: goes to the same confirm screen an invite link does. */
export async function enterCodeAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSignedIn("/");
  const code = normalizeInviteCode(field(formData, "code"));
  if (code === "") return { error: "Enter the code you were given" };
  redirect(`/join/${code}`);
}

export async function joinLeagueAction(formData: FormData): Promise<void> {
  const code = field(formData, "code");
  const { actor } = await requireSignedIn(`/join/${encodeURIComponent(code)}`);
  const { leagueId } = await joinLeagueByCode(actor, code);
  redirect(`/leagues/${leagueId}`);
}

export async function addGuestAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const leagueId = field(formData, "leagueId");
  const { actor } = await requireSignedIn(`/leagues/${leagueId}`);
  try {
    const guest = await addGuestPlayer(actor, leagueId, {
      displayName: field(formData, "displayName"),
    });
    revalidatePath(`/leagues/${leagueId}`);
    return { success: `Added ${guest.displayName}` };
  } catch (error) {
    return formError(error);
  }
}

export async function rotateInviteAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const leagueId = field(formData, "leagueId");
  const { actor } = await requireSignedIn(`/leagues/${leagueId}`);
  try {
    await rotateInviteCode(actor, leagueId);
  } catch (error) {
    return formError(error);
  }
  revalidatePath(`/leagues/${leagueId}`);
  return { success: "New code ready. The old one no longer works." };
}

export async function claimPlayerAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const leagueId = field(formData, "leagueId");
  const { actor } = await requireSignedIn(`/leagues/${leagueId}`);
  try {
    const playerId = field(formData, "playerId");
    if (playerId === "new") {
      await createOwnPlayer(actor, leagueId);
    } else {
      await claimGuestPlayer(actor, leagueId, playerId);
    }
  } catch (error) {
    return formError(error);
  }
  revalidatePath(`/leagues/${leagueId}`);
  return {};
}
