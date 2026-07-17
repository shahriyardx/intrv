import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Measure, shell } from "@/components/ui/page";
import { DataLabel, Prose } from "@/components/ui/prose";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { getViewer } from "@/server/dal/session";
import { AcceptInvite } from "./accept-invite";

export const metadata: Metadata = {
  title: "Join an organization",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ invitationId: string }> };

/**
 * Accepting a team invite deliberately lives outside the (org) group: an
 * invitee has no membership yet, and the org layout bounces anyone without one
 * to /dashboard — they would never reach the button.
 *
 * The invitation id is the capability, the same shape as an assessment's invite
 * token. Knowing it reveals only the org's name and the invited address, and
 * better-auth still refuses the accept unless the signed-in account's email
 * matches.
 */
export default function JoinPage({ params }: Props) {
  return (
    <>
      <SiteHeader />
      <main className={cn(shell, "flex flex-1 flex-col justify-center py-16")}>
        {/* Everything below is runtime IO — the invite row and the session —
            so it is the dynamic hole and the header above is the static shell. */}
        <Measure>
          <Suspense fallback={<div className="min-h-64" />}>
            <Invitation params={params} />
          </Suspense>
        </Measure>
      </main>
    </>
  );
}

async function Invitation({ params }: Props) {
  const { invitationId } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: {
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organization: { select: { name: true } },
    },
  });

  if (!invitation) notFound();

  const viewer = await getViewer();
  const expired = invitation.expiresAt.getTime() < Date.now();
  const spent = invitation.status !== "pending";

  return (
    <>
      <DataLabel>Invitation</DataLabel>
      <h1 className="mt-3 font-display text-display-lg">
        Join {invitation.organization.name}
      </h1>

      <Prose className="mt-4 text-muted-foreground">
        <p>
          You've been invited as {invitation.role === "admin" ? "an" : "a"}{" "}
          {invitation.role ?? "member"}. You'll be able to see every candidate
          who takes their assessments, including names, emails, and answers.
        </p>
      </Prose>

      <div className="mt-8">
        {spent ? (
          <Note>This invite has already been used.</Note>
        ) : expired ? (
          <Note>This invite has expired. Ask them to send a new one.</Note>
        ) : viewer.kind !== "user" ? (
          <div className="space-y-3">
            <Prose className="text-muted-foreground text-sm">
              <p>
                Sign in as{" "}
                <strong className="text-foreground">{invitation.email}</strong>{" "}
                to accept. The invite only works for that address.
              </p>
            </Prose>
            <Button asChild size="lg">
              <Link href={`/sign-in?next=/join/${invitationId}`}>
                Sign in to accept
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Prose className="text-muted-foreground text-sm">
              <p>
                Accepting as{" "}
                <strong className="text-foreground">{invitation.email}</strong>.
              </p>
            </Prose>
            <AcceptInvite invitationId={invitationId} />
          </div>
        )}
      </div>
    </>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border bg-muted/50 p-4 text-muted-foreground text-sm">
        {children}
      </p>
      <Button asChild variant="outline">
        <Link href="/">Back to Intrv</Link>
      </Button>
    </div>
  );
}
