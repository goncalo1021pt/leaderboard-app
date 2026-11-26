import type { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border-border flex flex-col gap-4 rounded-2xl border p-5">
      {title !== undefined && <h2 className="text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error !== undefined) {
    return (
      <p role="alert" className="text-danger text-sm">
        {error}
      </p>
    );
  }
  if (success !== undefined) {
    return (
      <p role="status" className="text-success text-sm">
        {success}
      </p>
    );
  }
  return null;
}

/** The narrow, centred column every screen uses: built for ~390px first. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[calc(2rem+var(--safe-top))] pb-[calc(2rem+var(--safe-bottom))]">
      {children}
    </main>
  );
}
