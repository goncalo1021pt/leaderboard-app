"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

import { type Variant, buttonClasses } from "./button-classes";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Shown while the surrounding form is submitting. */
  pendingLabel?: string;
}

/** A submit button that disables itself while its form is in flight. */
export function SubmitButton({
  variant,
  pendingLabel,
  className,
  children,
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      className={buttonClasses(variant, className)}
      {...rest}
    >
      {pending && pendingLabel !== undefined ? pendingLabel : children}
    </button>
  );
}
