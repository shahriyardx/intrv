import "server-only";
import { prisma } from "@/lib/db";
import type { OrgRole } from "@/server/dal/org";
import type { Viewer } from "@/server/dal/owner";

/**
 * Membership reads for /org/members.
 *
 * Member emails are PII, so the same gate as the rest of the org DAL applies:
 * resolve the viewer's own membership first, return null for a non-member, and
 * never a 403 that would confirm the org exists.
 */

export type OrgMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  joinedAt: Date;
  /** True for the viewer's own row — the UI must not offer to remove yourself. */
  isSelf: boolean;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: Date;
  /** Already past its expiry; the plugin refuses it, so the UI says so. */
  expired: boolean;
};

export type MembersView = {
  members: OrgMember[];
  invites: PendingInvite[];
  /** owner/admin manage; a plain member reads only. */
  canManage: boolean;
  viewerRole: OrgRole;
  /** Guards the last-owner rule in the UI as well as the action. */
  ownerCount: number;
};

export async function getMembersView(
  viewer: Viewer,
  orgId: string,
): Promise<MembersView | null> {
  if (viewer.kind !== "user") return null;

  const self = await prisma.member.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: viewer.userId },
    },
    select: { role: true },
  });

  if (!self) return null;

  const viewerRole = self.role as OrgRole;
  const canManage = viewerRole === "owner" || viewerRole === "admin";

  const [memberRows, inviteRows] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    // Only managers see who has been invited but hasn't joined — it is a list of
    // people's email addresses.
    canManage
      ? prisma.invitation.findMany({
          where: { organizationId: orgId, status: "pending" },
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, role: true, expiresAt: true },
        })
      : Promise.resolve([]),
  ]);

  const now = Date.now();

  return {
    viewerRole,
    canManage,
    ownerCount: memberRows.filter((m) => m.role === "owner").length,
    members: memberRows.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role as OrgRole,
      joinedAt: m.createdAt,
      isSelf: m.userId === viewer.userId,
    })),
    invites: inviteRows.map((i) => ({
      id: i.id,
      email: i.email,
      role: (i.role as OrgRole | null) ?? "member",
      expiresAt: i.expiresAt,
      expired: i.expiresAt.getTime() < now,
    })),
  };
}
