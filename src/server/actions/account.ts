"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DELETE_CONFIRMATION } from "@/app/(app)/dashboard/settings/confirmation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getViewer } from "@/server/dal/session";

/**
 * Server Functions are POST endpoints reachable directly, so every action here
 * re-establishes its own viewer and acts only on that viewer's own row. None of
 * them takes a user id: the only account you can touch is the one you are
 * signed in as.
 */

export type AccountState =
  | { status: "idle" }
  | { status: "saved"; name: string }
  | { status: "error"; error: string };

const nameSchema = z
  .string()
  .trim()
  .min(1, "Your name can't be empty.")
  .max(80, "Keep your name under 80 characters.")
  .refine(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
    (v) => !/[\u0000-\u001f\u007f]/.test(v),
    "Your name contains control characters.",
  );

export async function updateDisplayName(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") {
    return { status: "error", error: "You're signed out." };
  }

  const parsed = nameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Invalid name.",
    };
  }

  // Through better-auth rather than a direct Prisma write: session.cookieCache
  // means getSession() answers from the cookie for up to 5 minutes, so writing
  // the column behind better-auth's back leaves the header greeting the user by
  // their old name until the cache expires. updateUser refreshes the cookie with
  // the new user data as part of the write.
  await auth.api.updateUser({
    headers: await headers(),
    body: { name: parsed.data },
  });

  // The header and settings form are RSC reads of the session; without this they
  // keep rendering the previous name until something else invalidates them.
  revalidatePath("/", "layout");

  return { status: "saved", name: parsed.data };
}

export async function deleteAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState | never> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") {
    return { status: "error", error: "You're signed out." };
  }

  // The dialog already asks for this, but the dialog is UI and this is a POST
  // endpoint: the phrase is re-checked where the deleting actually happens.
  const confirmation = String(formData.get("confirm") ?? "")
    .trim()
    .toLowerCase();
  if (confirmation !== DELETE_CONFIRMATION) {
    return {
      status: "error",
      error: `Type "${DELETE_CONFIRMATION}" to confirm.`,
    };
  }

  // Sign out first, while the session still exists to be revoked. Session rows
  // cascade with the user, but the cookie would outlive them: session.cookieCache
  // means getSession() answers from the cookie for up to 5 minutes without
  // touching the database, so a deleted user would keep a working viewer.
  await auth.api.signOut({ headers: await headers() });

  // Cascades to sessions, accounts, and every interview session they took —
  // including the questions and answers under them.
  await prisma.user.delete({ where: { id: viewer.userId } });

  redirect("/");
}
