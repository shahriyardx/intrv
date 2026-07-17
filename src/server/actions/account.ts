"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DELETE_CONFIRMATION } from "@/app/(app)/dashboard/settings/confirmation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { usernameMessage, usernameProblem } from "@/lib/username";
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

export type UsernameState =
  | { status: "idle" }
  | { status: "saved"; username: string }
  | { status: "error"; error: string };

/**
 * A username may be changed exactly once. The `usernameChanged` flag is ours,
 * checked here in the DB (not the cookie cache) so a stale session can't be used
 * to change twice. On success the write goes through better-auth's updateUser —
 * which runs the username plugin's validation and uniqueness check and refreshes
 * the session cookie — and only then do we set the lock.
 */
export async function changeUsername(
  _prev: UsernameState,
  formData: FormData,
): Promise<UsernameState> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") {
    return { status: "error", error: "You're signed out." };
  }

  const raw = String(formData.get("username") ?? "").trim();
  const problem = usernameProblem(raw);
  if (problem) {
    return {
      status: "error",
      error: usernameMessage(problem) ?? "Invalid username.",
    };
  }
  const username = raw.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { id: viewer.userId },
    select: { username: true, usernameChanged: true },
  });
  if (!user) return { status: "error", error: "Your account is gone." };
  if (user.usernameChanged) {
    return {
      status: "error",
      error: "You've already changed your username once.",
    };
  }
  if (user.username === username) {
    return { status: "error", error: "That's already your username." };
  }

  // Taken by someone else? The unique index is the real guard; this is the
  // friendly message before hitting it.
  const clash = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (clash) {
    return { status: "error", error: "That username is taken." };
  }

  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: { username, displayUsername: raw },
    });
  } catch {
    // The plugin rejects on its own validation or a race on the unique index.
    return {
      status: "error",
      error: "That username isn't available. Try another.",
    };
  }

  // Our flag, which better-auth doesn't know about — set it only after the
  // handle actually changed, so a failed update never burns the one change.
  await prisma.user.update({
    where: { id: viewer.userId },
    data: { usernameChanged: true },
  });

  revalidatePath("/", "layout");

  return { status: "saved", username };
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
