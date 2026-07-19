import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { BadgeArt } from "@/components/game/badge-art";
import { OrgAccountGate } from "@/components/org/org-account-gate";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { shell } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getProgression } from "@/server/dal/learning";
import { getAuthSession, getViewer } from "@/server/dal/session";
import { DashboardNav } from "./nav";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard · Intrv" },
  // A personal history is not something to hand a crawler.
  robots: { index: false },
};

/**
 * The dashboard is the one area that requires an account: there is no guest
 * identity, so a signed-out visitor has no history to show. The gate lives here
 * so the redirect happens once rather than at the top of five pages.
 *
 * It is not the authorization boundary, though. It renders in parallel with the
 * page below it, so a page's queries may already be in flight when this
 * redirects — every one of them is owner-scoped through ownerWhere(), which
 * returns null for an anonymous viewer and matches nothing.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className={cn(shell, "flex-1 py-10")}>
        {/* Name over "Dashboard": every signed-in page said the same word, and
            the badges under it are the one thing here worth showing off. Both
            need the session, so they sit in a hole rather than blocking the
            route's static shell. */}
        <header className="mb-6">
          <Suspense fallback={<HeaderSkeleton />}>
            <DashboardHeader />
          </Suspense>
        </header>
        <DashboardNav />
        {/* The real path, not "/dashboard": this layout wraps every dashboard
            page, so a hardcoded target would strand someone who asked for
            /dashboard/review. */}
        <Suspense fallback={null}>
          <AuthGate fallback="/dashboard" />
        </Suspense>
        <OrgAccountGate />
        <div className="py-10">{children}</div>
      </main>
    </>
  );
}

async function DashboardHeader() {
  const [session, viewer] = await Promise.all([getAuthSession(), getViewer()]);
  const name = session?.user?.name?.trim() || session?.user?.email || "You";
  const progression = await getProgression(viewer);
  const earned = progression.badges.filter((badge) => badge.earned);

  return (
    <>
      <DataLabel>
        Level {progression.level.level} · {progression.level.title}
      </DataLabel>
      <h1 className="mt-2 font-display text-display-lg">{name}</h1>

      {earned.length > 0 ? (
        <Link
          href="/dashboard/badges"
          // Icons only, no names: this is a shelf, not a list. The badges page
          // is where the descriptions and the locked ones live.
          className="mt-3 flex flex-wrap items-center gap-1.5 rounded-md transition-opacity hover:opacity-80"
          title={`${earned.length} of ${progression.total} badges`}
        >
          {earned.map((badge) => (
            <BadgeArt key={badge.id} id={badge.id} earned className="size-7" />
          ))}
          <span className="ml-1 font-mono text-muted-foreground text-xs tabular">
            {earned.length}/{progression.total}
          </span>
        </Link>
      ) : null}
    </>
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-8 w-56" />
    </div>
  );
}
