"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { FormMessage } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

import {
  addGuestAction,
  claimPlayerAction,
  createLeagueAction,
  enterCodeAction,
  rotateInviteAction,
} from "./actions";

export function CreateLeagueForm() {
  const [state, action] = useActionState(createLeagueAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field
        label="League name"
        name="name"
        maxLength={60}
        required
        placeholder="Friday game night"
      />
      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Creating…">Create league</SubmitButton>
    </form>
  );
}

export function EnterCodeForm() {
  const [state, action] = useActionState(enterCodeAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field
        label="Invite code"
        name="code"
        required
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="ABCDE-12345"
        className="font-mono tracking-wider uppercase"
      />
      <FormMessage error={state.error} />
      <SubmitButton variant="secondary" pendingLabel="Checking…">
        Join with a code
      </SubmitButton>
    </form>
  );
}

export function AddGuestForm({ leagueId }: { leagueId: string }) {
  const [state, action] = useActionState(
    async (prev: FormState & { key: number }, formData: FormData) => {
      const result = await addGuestAction(prev, formData);
      // A new key after each success empties the name box for the next guest.
      return { ...result, key: result.success !== undefined ? prev.key + 1 : prev.key };
    },
    { key: 0 },
  );
  return (
    <form key={state.key} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="leagueId" value={leagueId} />
      <Field
        label="Add a guest"
        name="displayName"
        maxLength={60}
        required
        placeholder="Name"
        hint="Someone without an account. They can claim this player if they join later."
      />
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton variant="secondary" pendingLabel="Adding…">
        Add guest
      </SubmitButton>
    </form>
  );
}

export function InviteCard({
  leagueId,
  code,
  link,
  isOwner,
}: {
  leagueId: string;
  code: string;
  link: string;
  isOwner: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [state, action] = useActionState(rotateInviteAction, {});
  const pretty = `${code.slice(0, 5)}-${code.slice(5)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (http, permissions); the code is on screen anyway.
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Join my league", url: link });
        return;
      } catch {
        // Cancelled, or the share sheet failed: fall back to copying.
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-2xl font-semibold tracking-widest">{pretty}</p>
      <p className="text-muted text-sm">
        Anyone with this code or link can join. Send it to the group chat.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={share}
          className={buttonClasses("primary", "flex-1")}
        >
          {copied ? "Link copied" : "Share invite link"}
        </button>
      </div>
      {isOwner && (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="leagueId" value={leagueId} />
          <SubmitButton
            variant="ghost"
            pendingLabel="Replacing…"
            className="h-auto self-start px-0 text-sm"
          >
            Code leaked? Replace it
          </SubmitButton>
          <FormMessage error={state.error} success={state.success} />
        </form>
      )}
    </div>
  );
}

export function WhoAreYou({
  leagueId,
  guests,
}: {
  leagueId: string;
  guests: { id: string; displayName: string }[];
}) {
  const [state, action] = useActionState(claimPlayerAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="leagueId" value={leagueId} />
      {guests.length > 0 && (
        <>
          <p className="text-muted text-sm">
            If someone already recorded games for you as a guest, pick that name to keep
            them.
          </p>
          <div className="flex flex-col gap-2">
            {guests.map((guest) => (
              <SubmitButton
                key={guest.id}
                name="playerId"
                value={guest.id}
                variant="secondary"
              >
                I&apos;m {guest.displayName}
              </SubmitButton>
            ))}
          </div>
        </>
      )}
      <SubmitButton
        name="playerId"
        value="new"
        variant={guests.length > 0 ? "ghost" : "primary"}
      >
        {guests.length > 0 ? "None of these, I'm new here" : "Add me as a player"}
      </SubmitButton>
      <FormMessage error={state.error} />
    </form>
  );
}
