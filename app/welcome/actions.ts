"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth, getSignedIn, safeNext } from "@/lib/auth/server";
import { displayNameSchema } from "@/lib/db/inputs";
import { type FormState, field, formError } from "@/lib/forms";

export async function setNameAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  if ((await getSignedIn()) === null) redirect("/login");
  try {
    const name = displayNameSchema.parse(field(formData, "name"));
    await getAuth().api.updateUser({ body: { name }, headers: await headers() });
  } catch (error) {
    return formError(error);
  }
  redirect(safeNext(field(formData, "next")));
}
