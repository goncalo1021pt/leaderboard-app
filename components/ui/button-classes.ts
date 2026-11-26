/* Plain module, not "use client", so server components can style links as buttons. */

export type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  secondary: "border border-border bg-background hover:bg-surface",
  ghost: "text-muted hover:text-foreground",
};

export function buttonClasses(variant: Variant = "primary", className = ""): string {
  // h-12: a comfortable thumb target on a phone.
  return `inline-flex h-12 items-center justify-center rounded-xl px-5 text-base font-semibold transition disabled:opacity-50 ${variants[variant]} ${className}`;
}
