"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { OrgRole } from "@/server/dal/org";

export type ActionError = { ok: false; error: string };

/**
 * Member management for the org surface.
 *
 * Server Functions are POST endpoints reachable directly, so every action here
 * re-resolves the caller's membership and role from the database. It also reads
 * the session with the cookie cache disabled: these are privileged operations,
 * and the 5-minute cache would otherwise let someone who was just demoted keep
 * promoting people.
 *
 * The role checks are duplicated here rather than delegated to better-auth's
 * own permission system on purpose — the plugin would let an org admin manage
 * members, but it does not know our last-owner rule, and an org that can lock
 * every owner out of itself is a support ticket we would have to fix by hand.
 */

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(160);

const roleSchema = z.enum(["admin", "member"]);

type Caller = {
  userId: string;
  orgId: string;
  role: OrgRole;
};

/** The caller's authoritative membership, or null. Never trusts the cookie cache. */
async function requireManager(): Promise<Caller | null> {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });

  const userId = session?.user?.id;
  if (!userId) return null;

  const membership = await prisma.member.findFirst({
    where: {
      userId,
      // One org per user, so the single membership is unambiguous and we never
      // have to trust session.activeOrganizationId, which is a claim.
      ...(session.session.activeOrganizationId
        ? { organizationId: session.session.activeOrganizationId }
        : {}),
    },
    select: { organizationId: true, role: true },
  });

  const fallback =
    membership ??
    (await prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    }));

  if (!fallback) return null;

  const role = fallback.role as OrgRole;
  if (role !== "owner" && role !== "admin") return null;

  return { userId, orgId: fallback.organizationId, role };
}

export async function inviteMember(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true; invitationId: string } | ActionError> {
  const caller = await requireManager();
  if (!caller)
    return { ok: false, error: "You can't manage this organization." };

  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) {
    return {
      ok: false,
      error: email.error.issues[0]?.message ?? "Invalid email.",
    };
  }

  const role = roleSchema.safeParse(formData.get("role") ?? "member");
  if (!role.success) return { ok: false, error: "Pick a role." };

  // Only an owner can mint another owner, and we don't offer it in the UI at
  // all — an org gets its owner at sign-up.
  const existing = await prisma.member.findFirst({
    where: { organizationId: caller.orgId, user: { email: email.data } },
    select: { id: true },
  });
  if (existing)
    return { ok: false, error: "They're already in this organization." };

  try {
    const invitation = await auth.api.createInvitation({
      headers: await headers(),
      body: {
        email: email.data,
        role: role.data,
        organizationId: caller.orgId,
        resend: true,
      },
    });

    revalidatePath("/org/members");
    return { ok: true, invitationId: invitation.id };
  } catch (error) {
    // The plugin rejects a duplicate outstanding invite; that is not a fault.
    const message =
      error instanceof Error && /already/i.test(error.message)
        ? "They already have a pending invite."
        : "We couldn't create that invite.";
    return { ok: false, error: message };
  }
}

export async function cancelInvite(
  invitationId: string,
): Promise<{ ok: true } | ActionError> {
  const caller = await requireManager();
  if (!caller)
    return { ok: false, error: "You can't manage this organization." };

  // Scope the invite to the caller's own org before touching it: the id comes
  // from the client and proves nothing on its own.
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { organizationId: true },
  });

  if (!invitation || invitation.organizationId !== caller.orgId) {
    return { ok: false, error: "Invite not found." };
  }

  await auth.api.cancelInvitation({
    headers: await headers(),
    body: { invitationId },
  });

  revalidatePath("/org/members");
  return { ok: true };
}

export async function changeMemberRole(
  memberUserId: string,
  role: "admin" | "member",
): Promise<{ ok: true } | ActionError> {
  const caller = await requireManager();
  if (!caller)
    return { ok: false, error: "You can't manage this organization." };

  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "Unknown role." };

  const target = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: caller.orgId,
        userId: memberUserId,
      },
    },
    select: { role: true },
  });

  if (!target) return { ok: false, error: "Member not found." };

  // Demoting the last owner leaves an org nobody can administer.
  if (target.role === "owner") {
    return { ok: false, error: "An owner's role can't be changed here." };
  }

  // An admin outranking another admin would let two people fight over the org.
  if (caller.role !== "owner" && target.role === "admin") {
    return { ok: false, error: "Only the owner can change an admin's role." };
  }

  await auth.api.updateMemberRole({
    headers: await headers(),
    body: {
      memberId: memberUserId,
      role: parsed.data,
      organizationId: caller.orgId,
    },
  });

  revalidatePath("/org/members");
  return { ok: true };
}

export async function removeMember(
  memberUserId: string,
): Promise<{ ok: true } | ActionError> {
  const caller = await requireManager();
  if (!caller)
    return { ok: false, error: "You can't manage this organization." };

  if (memberUserId === caller.userId) {
    // Removing yourself is "leave", not "remove", and we don't offer it: an org
    // account with no membership is neither an org account nor a personal one,
    // and the account gate would bounce them between /org and /dashboard.
    return { ok: false, error: "You can't remove yourself." };
  }

  const target = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: caller.orgId,
        userId: memberUserId,
      },
    },
    select: { role: true },
  });

  if (!target) return { ok: false, error: "Member not found." };
  if (target.role === "owner") {
    return { ok: false, error: "The owner can't be removed." };
  }
  if (caller.role !== "owner" && target.role === "admin") {
    return { ok: false, error: "Only the owner can remove an admin." };
  }

  await auth.api.removeMember({
    headers: await headers(),
    body: { memberIdOrEmail: memberUserId, organizationId: caller.orgId },
  });

  revalidatePath("/org/members");
  return { ok: true };
}
