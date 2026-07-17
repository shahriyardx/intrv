import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { shell } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main
        className={cn(
          shell,
          "flex flex-1 flex-col items-center justify-center py-24 text-center",
        )}
      >
        <DataLabel>404</DataLabel>
        <h1 className="mt-3 font-display text-display-lg">Nothing here</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          This page doesn't exist, or the interview belongs to someone else.
        </p>
        <Button asChild className="mt-8">
          <Link href="/start">Start an interview</Link>
        </Button>
      </main>
    </>
  );
}
