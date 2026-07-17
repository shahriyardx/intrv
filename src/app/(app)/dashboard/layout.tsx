import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrgAccountGate } from "@/components/org/org-account-gate";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { DataLabel } from "@/components/ui/prose";
import { getViewer } from "@/server/dal/session";
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
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
  if (viewer.kind !== "user") redirect("/sign-in?next=/dashboard");
  return null;
}
