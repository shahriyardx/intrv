import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { DataLabel } from "@/components/ui/prose";
import { getActiveOrg } from "@/server/dal/org";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = {
  title: { default: "Organizations", template: "%s · Organizations · Intrv" },
  // Screening reports carry candidate PII; never hand them to a crawler.
  robots: { index: false },
};

/**
 * Organizations are a signed-in surface: there is no guest identity, so an
 * anonymous visitor has no orgs to show. The gate lives in the shell below the
 * Suspense boundary because reading the session is runtime IO — awaited in the
 * layout body it would block the whole route's static shell and fail the build.
 *
 * It is not the authorization boundary. A layout does not re-run on client
 * navigation and never runs for the Server Functions these pages call, so every
 * DAL read and every action re-checks membership itself.
 */
export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-svh" />}>
      <OrgShell>{children}</OrgShell>
    </Suspense>
  );
}

async function OrgShell({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer.kind !== "user") redirect("/sign-in?next=/org");

  // The org surface is for organization accounts only. A signed-in personal
  // account has no org (org creation is signup-only) and is sent to their own
  // dashboard — the mirror of the (app) gate that sends org accounts here.
  if (!(await getActiveOrg())) redirect("/dashboard");

  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <header className="mb-8">
          <DataLabel>For recruiters</DataLabel>
          <h1 className="mt-1 font-display text-lg">Organizations</h1>
        </header>
        {children}
      </main>
    </>
  );
}
