"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireFreshAdmin } from "@/server/dal/admin";

export type AdminActionState =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Every action here re-establishes its own admin, with the session cookie cache
 * disabled. Two reasons, both load-bearing:
 *
 *  - Server Functions are POST endpoints reachable directly. The page that
 *    rendered the button is not evidence of anything.
 *  - The cookie cache would otherwise let an admin who was demoted or banned
 *    seconds ago keep promoting and banning for another five minutes.
 *
 * A non-admin gets the same flat "Not found." every caller gets, so /admin's
 * existence isn't confirmed by the shape of a refusal.
 */
const NOT_FOUND: AdminActionState = { ok: false, error: "Not found." };

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["admin", "user"]),
});

const banSchema = z.object({
  userId: z.string().min(1),
  banReason: z
    .string()
    .trim()
    .min(3, "Give a reason — future you will ask why.")
    .max(200),
  banDays: z.coerce.number().int().min(1).max(3650).nullable(),
});

const userIdSchema = z.object({ userId: z.string().min(1) });

function fieldError(error: z.ZodError): AdminActionState {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input." };
}

/** better-auth throws APIError; its message is operator-facing and safe to show. */
function failed(error: unknown, fallback: string): AdminActionState {
  const message = error instanceof Error ? error.message : "";
  return { ok: false, error: message || fallback };
}

export async function setUserRoleAction(
  _prev: unknown,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireFreshAdmin();
  if (!admin) return NOT_FOUND;

  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return fieldError(parsed.error);

  // better-auth guards self-ban and self-delete but not self-demote, and an
  // admin who demotes themselves has locked everyone out of this dashboard.
  if (parsed.data.userId === admin.userId) {
    return { ok: false, error: "You can't change your own role." };
  }

  try {
    await auth.api.setRole({
      body: { userId: parsed.data.userId, role: parsed.data.role },
      headers: await headers(),
    });
  } catch (error) {
    return failed(error, "Couldn't change that role.");
  }

  revalidatePath("/admin/users");
  return {
    ok: true,
    message:
      parsed.data.role === "admin" ? "Promoted to admin." : "Demoted to user.",
  };
}

export async function banUserAction(
  _prev: unknown,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireFreshAdmin();
  if (!admin) return NOT_FOUND;

  const rawDays = formData.get("banDays");
  const parsed = banSchema.safeParse({
    userId: formData.get("userId"),
    banReason: formData.get("banReason"),
    banDays: rawDays ? rawDays : null,
  });
  if (!parsed.success) return fieldError(parsed.error);

  if (parsed.data.userId === admin.userId) {
    return { ok: false, error: "You can't ban yourself." };
  }

  try {
    await auth.api.banUser({
      body: {
        userId: parsed.data.userId,
        banReason: parsed.data.banReason,
        // The plugin takes seconds; omitting it bans until someone lifts it.
        ...(parsed.data.banDays
          ? { banExpiresIn: parsed.data.banDays * 86_400 }
          : {}),
      },
      headers: await headers(),
    });
  } catch (error) {
    return failed(error, "Couldn't ban that user.");
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "User banned. Their sessions were revoked." };
}

export async function unbanUserAction(
  _prev: unknown,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireFreshAdmin();
  if (!admin) return NOT_FOUND;

  const parsed = userIdSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return fieldError(parsed.error);

  try {
    await auth.api.unbanUser({
      body: { userId: parsed.data.userId },
      headers: await headers(),
    });
  } catch (error) {
    return failed(error, "Couldn't unban that user.");
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "Ban lifted." };
}

/**
 * Delete a user and everything cascading off them.
 *
 * This is the only irreversible action on this dashboard. It removes their
 * account rows, auth sessions, interview history, answers and review items —
 * every FK back to User is `onDelete: Cascade`. Two things deliberately
 * survive:
 *
 * - **Blog posts**, whose author is `onDelete: SetNull`. Published writing is
 *   not the author's to take down by leaving.
 * - **AiCall telemetry**, which has no user FK at all. It is cost accounting,
 *   it carries no prompt text, and losing it would silently rewrite spend
 *   history.
 *
 * Prefer banning. A ban revokes sessions and locks the account while keeping
 * the record; this exists for the cases a ban cannot answer — a deletion
 * request, or a spam signup worth erasing rather than archiving.
 */
export async function deleteUserAction(
  _prev: unknown,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireFreshAdmin();
  if (!admin) return NOT_FOUND;

  const parsed = userIdSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return fieldError(parsed.error);

  // better-auth guards this too, but an admin deleting themselves would take
  // the dashboard with them, so it is refused here first and explicitly.
  if (parsed.data.userId === admin.userId) {
    return { ok: false, error: "You can't delete your own account." };
  }

  try {
    await auth.api.removeUser({
      body: { userId: parsed.data.userId },
      headers: await headers(),
    });
  } catch (error) {
    return failed(error, "Couldn't delete that user.");
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "User deleted, along with all of their data." };
}
