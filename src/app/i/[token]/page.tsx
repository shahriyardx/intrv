import {
  ClockIcon,
  ListNumbersIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { DataLabel } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { getAssessmentByInviteToken } from "@/server/dal/org";
import { StartScreenForm } from "./start-form";

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
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-14">
        <Suspense fallback={<InviteSkeleton />}>
          <Invite params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Invite({ params }: Props) {
  const { token } = await params;
  const assessment = await getAssessmentByInviteToken(token);

  // Unknown or deactivated token: notFound() discloses nothing about which it
  // was, or whether the link was ever real.
  if (!assessment) notFound();

  const minutes = assessment.timeLimitMs
    ? assessment.timeLimitMs / 60_000
    : null;

  return (
    <div className="space-y-10">
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
        <p className="mb-5 text-sm text-muted-foreground">
          No account needed. Enter your details and you'll go straight in.
        </p>
        <StartScreenForm token={token} />
      </div>
    </div>
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
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-56 w-full rounded-md" />
    </div>
  );
}
