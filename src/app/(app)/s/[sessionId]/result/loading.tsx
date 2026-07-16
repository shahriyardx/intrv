import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors result/page.tsx: action row, the score block, then review cards. */
export default function ResultLoading() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>

        <div className="space-y-12">
          <section className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-end">
            <div className="space-y-3">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-[4.5rem] w-36" />
            </div>
            <div className="space-y-2 sm:pb-2">
              <Skeleton className="h-4 w-full max-w-[34ch]" />
              <Skeleton className="h-4 w-3/5 max-w-[24ch]" />
            </div>
          </section>

          <section className="space-y-3">
            <Skeleton className="h-3 w-36" />
            <div className="flex flex-wrap gap-2">
              {[9, 8.5, 9.5, 10, 8, 7].map((w, i) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder
                  key={i}
                  className="h-8 rounded-md"
                  style={{ width: `${w}rem` }}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <Skeleton className="h-3 w-28" />
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-4 rounded-md border p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-full space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                    <Skeleton className="h-6 w-24 shrink-0 rounded" />
                  </div>
                  <div className="space-y-3">
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        className="grid gap-4 sm:grid-cols-[7rem_1fr]"
                      >
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-4 w-4/5" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
