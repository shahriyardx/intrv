import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";

/**
 * The read-me pages: about and the two legal ones. They are prose at a reading
 * measure, so the shell caps width here rather than in every page.
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:py-20">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
