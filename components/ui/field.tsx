import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Field({ label, hint, id, name, className = "", ...rest }: Props) {
  const inputId = id ?? name;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        id={inputId}
        name={name}
        // text-base (16px) stops iOS Safari zooming the page on focus.
        className={`border-border bg-background focus:border-foreground h-12 rounded-xl border px-4 text-base outline-none ${className}`}
        {...rest}
      />
      {hint !== undefined && <span className="text-muted text-sm">{hint}</span>}
    </label>
  );
}
