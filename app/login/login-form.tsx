"use client";

import { useState } from "react";

import { FormMessage } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import { buttonClasses } from "@/components/ui/button-classes";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export function LoginForm({ next, mailpitUrl }: { next: string; mailpitUrl?: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  if (status.kind === "sent") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-lg font-semibold">Check your email</p>
        <p className="text-muted">
          We sent a sign-in link to{" "}
          <span className="text-foreground font-medium">{status.email}</span>. Open it on
          this device. It works once and expires in 15 minutes.
        </p>
        {mailpitUrl !== undefined && (
          <a
            href={mailpitUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline"
          >
            Development: open the Mailpit inbox
          </a>
        )}
        <button
          type="button"
          className={buttonClasses("ghost", "self-start px-0")}
          onClick={() => setStatus({ kind: "idle" })}
        >
          Use a different email
        </button>
      </div>
    );
  }

  async function submit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    setStatus({ kind: "sending" });
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: next,
      newUserCallbackURL: `/welcome?next=${encodeURIComponent(next)}`,
      errorCallbackURL: "/login?error=link",
    });
    if (error) {
      setStatus({
        kind: "error",
        message:
          error.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : (error.message ?? "Couldn't send the link. Try again."),
      });
      return;
    }
    setStatus({ kind: "sent", email });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        autoFocus
      />
      <FormMessage error={status.kind === "error" ? status.message : undefined} />
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className={buttonClasses("primary")}
      >
        {status.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
