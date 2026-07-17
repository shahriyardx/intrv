import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { shell } from "@/components/ui/page";
import { cn } from "@/lib/utils";

/**
 * The read-me pages plus the leaderboard. The layout owns the shell and the
 * <main>; each page picks its own measure, because they are not all prose — the
 * leaderboard is a table and wants the full width the rest of them must not
 * take.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className={cn(shell, "flex-1 py-16 sm:py-20")}>{children}</main>
      <SiteFooter />
    </>
  );
}
