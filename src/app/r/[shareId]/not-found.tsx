import { LinkBreakIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * A dead share link is its own story: the id is the only credential, so "not
 * found" here means revoked, mistyped, or never graded — not "signed in as the
 * wrong person".
 */
export default function ShareNotFound() {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24">
        <EmptyState
          icon={<LinkBreakIcon weight="duotone" />}
          title="This link doesn't lead anywhere"
          description="The result was never shared, sharing was turned off, or the link got mangled on its way to you. Ask for a fresh one."
          action={
            <Button asChild>
              <Link href="/start">Take one yourself</Link>
            </Button>
          }
        />
      </main>
    </>
  );
}
