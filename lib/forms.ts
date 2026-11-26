import { ZodError } from "zod";

import { ForbiddenError, NotFoundError } from "@/lib/db/errors";

/** What a form's server action hands back to useActionState. */
export interface FormState {
  error?: string;
  success?: string;
}

/**
 * Turns an expected failure into a message for the person at the form.
 * Anything else is a bug: rethrown, so it reaches the error boundary and logs
 * instead of being shown as if it were the user's fault.
 */
export function formError(error: unknown): FormState {
  if (error instanceof ZodError) {
    return { error: error.issues[0]?.message ?? "That doesn't look right" };
  }
  if (error instanceof NotFoundError || error instanceof ForbiddenError) {
    return { error: error.message };
  }
  throw error;
}

export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
