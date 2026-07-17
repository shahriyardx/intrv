import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { formatDate } from "@/components/admin/format";
import { SectionHeading } from "@/components/admin/section-heading";
import {
  CancelInviteButton,
  InviteForm,
  MemberRoleSelect,
  RemoveMemberButton,
} from "@/components/org/member-controls";
import { Badge } from "@/components/ui/badge";
import { DataLabel, Prose } from "@/components/ui/prose";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getActiveOrg } from "@/server/dal/org";
import { getMembersView } from "@/server/dal/org-members";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = {
  title: "Members",
  // Member emails are PII.
  robots: { index: false, follow: false },
};

export default async function OrgMembersPage() {
  const org = await getActiveOrg();
  if (!org) redirect("/dashboard");

  const viewer = await getViewer();
  const view = await getMembersView(viewer, org.id);

  // The layout gate does not protect this page — layouts don't re-run on client
  // navigation. Non-members get the same nothing they'd get for a bad id.
  if (!view) notFound();

  const { members, invites, canManage } = view;

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <SectionHeading label="Members" title="Who can see your candidates" />
        <Prose className="text-sm text-muted-foreground">
          <p>
            Everyone here can read every candidate's report, including their
            name, email, and answers. Admins can also create screens and invite
            people; members read only.
          </p>
        </Prose>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Joined</TableHead>
              {canManage ? <TableHead className="w-24" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="max-w-48 truncate font-medium">
                  {member.name}
                  {member.isSelf ? (
                    <span className="ml-2 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
                      you
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-56 truncate font-mono text-muted-foreground text-xs">
                  {member.email}
                </TableCell>
                <TableCell>
                  {/* The owner's role is fixed: an org with no owner is one
                      nobody can administer. */}
                  {canManage && !member.isSelf && member.role !== "owner" ? (
                    <MemberRoleSelect
                      userId={member.userId}
                      role={member.role as "admin" | "member"}
                    />
                  ) : (
                    <Badge variant="outline" className="text-[0.625rem]">
                      {member.role}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-xs">
                  {formatDate(member.joinedAt)}
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    {member.isSelf || member.role === "owner" ? null : (
                      <RemoveMemberButton
                        userId={member.userId}
                        name={member.name}
                      />
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {canManage ? (
        <>
          <section className="space-y-6">
            <SectionHeading label="Invite" title="Add a teammate" />
            <InviteForm />
          </section>

          <section className="space-y-4">
            <DataLabel as="h2">Pending invites</DataLabel>
            {invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No one is waiting to join.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Expires</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="max-w-56 truncate font-mono text-xs">
                        {invite.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[0.625rem]">
                          {invite.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {invite.expired ? (
                          <span className="text-partial">expired</span>
                        ) : (
                          <span className="text-muted-foreground">
                            {formatDate(invite.expiresAt)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <CancelInviteButton
                          invitationId={invite.id}
                          email={invite.email}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
