import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { shell } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { cn } from "@/lib/utils";
import { getAdminViewer } from "@/server/dal/admin";

/**
 * The layout itself is synchronous, and everything that reads the session lives
 * under the Suspense boundary below. Two rules meet here:
 *
 *  - cacheComponents: uncached IO outside <Suspense> blocks the whole route
 *    from prerendering a shell, which Next reports as a blocking-route error.
 *  - Disclosure: whatever ends up in that prerendered shell is served to
 *    everyone, signed in or not. So the shell must be anonymous — no "Admin"
 *    heading, no nav. Anything naming this surface renders *after* the gate.
 *
 * The fallback is therefore deliberately blank rather than a nice skeleton.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-svh" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

/**
 * Checks admin status, and every page under it checks again. That is not
 * belt-and-braces theatre: a layout is not a security boundary — it doesn't
 * re-run on every client navigation, and it never runs at all for the Server
 * Functions those pages call.
 *
 * notFound(), never a 403: an ordinary user probing /admin learns nothing about
 * whether the route exists.
 */
async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await getAdminViewer();
  if (!admin) notFound();

  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <div className={cn(shell, "flex-1 py-10")}>
        <header className="mb-6">
          <DataLabel>Internal</DataLabel>
          <h1 className="mt-1 font-display text-lg">Admin</h1>
        </header>
        <AdminNav />
        <main className="py-10">{children}</main>
      </div>
    </>
  );
}
