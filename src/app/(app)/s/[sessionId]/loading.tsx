import { SiteHeader } from "@/components/site-header";
import { Measure, shell } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Mirrors the runner mid-interview: meta row, progress, question card, then the
 * nav. The shape is known, so this is a placeholder rather than a spinner.
 */
export default function SessionLoading() {
  return (
    <>
      <SiteHeader />
      <main className={cn(shell, "flex-1 py-10")}>
        <Measure>
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>

            <div className="space-y-5 rounded-md border p-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t pt-6">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </Measure>
      </main>
    </>
  );
}
