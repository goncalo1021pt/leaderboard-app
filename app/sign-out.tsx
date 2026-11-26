import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/ui/button";
import { getAuth } from "@/lib/auth/server";

async function signOutAction() {
  "use server";
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/");
}

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <SubmitButton variant="ghost" className="h-auto px-0 text-sm">
        Sign out
      </SubmitButton>
    </form>
  );
}
