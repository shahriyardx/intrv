import {
  ClockIcon,
  ListNumbersIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Measure, shell } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getAssessmentByInviteToken } from "@/server/dal/org";
import { getAuthSession } from "@/server/dal/session";
import { StartAssessmentForm } from "./start-form";

// An invite is a private capability link, never something to index.
export const metadata: Metadata = {
  title: "You're invited to a screening",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

/**
 * Public candidate entry. Synchronous so the shell stays prerenderable: `params`
 * is runtime data under cacheComponents, so the token lookup goes down into the
 * Suspense boundary and is awaited there — awaiting it here would leave the
 * route with no static shell.
 */
export default function InvitePage({ params }: Props) {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className={cn(shell, "flex-1 py-14")}>
        <Suspense fallback={<InviteSkeleton />}>
          <Invite params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Invite({ params }: Props) {
  const { token } = await params;

  // Sign-in is checked before the token is looked up, so a signed-out visitor
  // gets the same sign-in page for a real token as for a made-up one and can't
  // use this route to test whether a token exists.
  const authSession = await getAuthSession();
  const user = authSession?.user;
  if (!user) redirect(`/sign-in?next=/i/${encodeURIComponent(token)}`);

  const assessment = await getAssessmentByInviteToken(token);

  // Unknown or deactivated token: notFound() discloses nothing about which it
  // was, or whether the link was ever real.
  if (!assessment) notFound();

  const minutes = assessment.timeLimitMs
    ? assessment.timeLimitMs / 60_000
    : null;

  return (
    <Measure className="space-y-10">
      <div>
        <DataLabel>{assessment.orgName} · Screening</DataLabel>
        <h1 className="mt-2 font-display text-display-lg">
          {assessment.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {assessment.orgName} invited you to take a short screening interview
          on {assessment.topic}. Answer in one sitting — the timer runs once you
          start.
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-4 border-y py-5">
        <Fact icon={<ListNumbersIcon weight="duotone" />} label="Questions">
          {assessment.questionCount}
        </Fact>
        <Fact icon={<ClockIcon weight="duotone" />} label="Time limit">
          {minutes ? `${minutes} min` : "Untimed"}
        </Fact>
        <Fact icon={<ShieldCheckIcon weight="duotone" />} label="Difficulty">
          <span className="capitalize">
            {assessment.difficulty.toLowerCase()}
          </span>
        </Fact>
      </dl>

      <div className="rounded-md border p-6">
        {/* Say whose name lands on the report before they start, not after:
            it's the one thing here they can't change once the timer runs. */}
        <p className="mb-5 text-sm text-muted-foreground">
          {assessment.orgName} will see this attempt as{" "}
          <strong className="font-medium text-foreground">
            {user.name?.trim() || user.email}
          </strong>{" "}
          <span className="font-mono text-xs">({user.email})</span>.
        </p>
        <StartAssessmentForm token={token} />
      </div>
    </Measure>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-sm bg-muted text-muted-foreground [&_svg]:size-4"
      >
        {icon}
      </span>
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono text-sm tabular">{children}</dd>
    </div>
  );
}

function InviteSkeleton() {
  // Same Measure as the real thing, so the content doesn't jump width when it
  // arrives.
  return (
    <Measure className="space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-56 w-full rounded-md" />
    </Measure>
  );
}
