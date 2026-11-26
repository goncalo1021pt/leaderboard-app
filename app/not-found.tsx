import Link from "next/link";

import { buttonClasses } from "@/components/ui/button-classes";
import { Page } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Page>
      <div className="flex flex-1 flex-col justify-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="text-muted">
          This page doesn&apos;t exist, or it belongs to a league you&apos;re not in.
        </p>
        <Link href="/" className={buttonClasses("secondary")}>
          Back home
        </Link>
      </div>
    </Page>
  );
}
