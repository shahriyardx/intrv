import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrgAccountGate } from "@/components/org/org-account-gate";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { shell } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { cn } from "@/lib/utils";
import { getViewer, signInHere } from "@/server/dal/session";
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
        <header className="mb-6">
          <DataLabel>Your work</DataLabel>
          <h1 className="mt-2 font-display text-display-lg">Dashboard</h1>
        </header>
        <DashboardNav />
        {/* getViewer() reads headers, which cacheComponents treats as runtime
            data: awaiting it in the layout body would block the whole route's
            static shell and fail the build. Isolated here, the shell above
            prerenders and only the gate waits on the request. */}
        <Suspense fallback={null}>
          <AuthGate />
        </Suspense>
        <OrgAccountGate />
        <div className="py-10">{children}</div>
      </main>
    </>
  );
}

async function AuthGate() {
  const viewer = await getViewer();
  // The real path, not "/dashboard": this layout wraps every dashboard page, so
  // a hardcoded target would strand someone who asked for /dashboard/review.
  if (viewer.kind !== "user") redirect(await signInHere("/dashboard"));
  return null;
}
