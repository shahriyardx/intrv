import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors start/page.tsx and the Configurator's field rhythm so nothing jumps. */
export default function StartLoading() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-10 w-[26rem] max-w-full" />

        <div className="mt-10 space-y-10">
          <Field>
            <Skeleton className="h-12 w-full" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[5, 6, 7, 5, 6].map((w, i) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder
                  key={i}
                  className="h-6 rounded-full"
                  style={{ width: `${w}rem` }}
                />
              ))}
            </div>
          </Field>

          <Field>
            <div className="grid gap-2 sm:grid-cols-3">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          </Field>

          <div className="grid gap-10 sm:grid-cols-2">
            <Field>
              <div className="grid gap-2">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            </Field>

            <div className="space-y-10">
              <Field>
                <div className="flex gap-2">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                </div>
              </Field>
              <Field>
                <div className="flex flex-wrap gap-2">
                  {[4.5, 3.5, 4, 4, 4].map((w, i) => (
                    <Skeleton
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder
                      key={i}
                      className="h-9"
                      style={{ width: `${w}rem` }}
                    />
                  ))}
                </div>
              </Field>
            </div>
          </div>

          <Skeleton className="h-10 w-44" />
        </div>
      </main>
    </>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-20" />
      {children}
    </div>
  );
}
