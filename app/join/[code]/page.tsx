import Link from "next/link";
import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { Card, Page } from "@/components/ui/card";
import { requireSignedIn } from "@/lib/auth/server";
import { previewInvite } from "@/lib/db/leagues";

import { joinLeagueAction } from "../../leagues/actions";

export const metadata = { title: "Join a league · Leaderboard" };

/**
 * Where an invite link lands. It asks before joining: a GET that joined on
 * its own would let any page that embeds the link enrol a visitor silently.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { actor } = await requireSignedIn(`/join/${encodeURIComponent(code)}`);
  const invite = await previewInvite(actor, code);

  if (invite?.alreadyMember) redirect(`/leagues/${invite.leagueId}`);

  return (
    <Page>
      {invite === null ? (
        <Card title="That invite doesn't work">
          <p className="text-muted">
            The code may have a typo, or the league owner replaced it with a new one. Ask
            them for the current link.
          </p>
          <Link href="/" className={buttonClasses("secondary")}>
            Back home
          </Link>
        </Card>
      ) : (
        <Card title={`Join ${invite.name}?`}>
          <p className="text-muted">
            You&apos;ll see its players and standings, and can record games in it.
          </p>
          <form action={joinLeagueAction} className="flex flex-col gap-2">
            <input type="hidden" name="code" value={code} />
            <SubmitButton pendingLabel="Joining…">Join league</SubmitButton>
            <Link href="/" className={buttonClasses("ghost")}>
              Not now
            </Link>
          </form>
        </Card>
      )}
    </Page>
  );
}
