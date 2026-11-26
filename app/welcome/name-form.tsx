"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

import { setNameAction } from "./actions";

export function NameForm({ next, current }: { next: string; current: string }) {
  const [state, action] = useActionState(setNameAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field
        label="Your name"
        name="name"
        defaultValue={current}
        autoComplete="given-name"
        maxLength={60}
        required
        autoFocus
        hint="What your friends call you. It's how you'll appear in the standings."
      />
      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Saving…">Continue</SubmitButton>
    </form>
  );
}
