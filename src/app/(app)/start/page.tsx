import type { Metadata } from "next";
import { Suspense } from "react";
import { OrgAccountGate } from "@/components/org/org-account-gate";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Measure, shell } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { cn } from "@/lib/utils";
import { getInterviewUsage } from "@/server/dal/limits";
import { getViewer } from "@/server/dal/session";
import { Configurator } from "./configurator";

export const metadata: Metadata = {
  title: "Start an interview",
  description:
    "Pick a topic or paste a job description. We generate the interview and grade it.",
};

export default function StartPage() {
  return (
    <>
      <OrgAccountGate />
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className={cn(shell, "flex-1 py-14")}>
        <Measure>
          <DataLabel>New session</DataLabel>
          <h1 className="mt-3 font-display text-display-lg">
            What should we test you on?
          </h1>
          {/* Request-time, so it sits in a hole rather than making the whole
              page dynamic. No fallback: an empty line beats a skeleton that
              shifts the form down as it resolves. */}
          <Suspense fallback={null}>
            <DailyAllowance />
          </Suspense>
          <div className="mt-10">
            <Configurator />
          </div>
        </Measure>
      </main>
    </>
  );
}

/**
 * Today's usage against the daily cap. Shown from halfway on: telling someone
 * they have used 1 of 5 is noise, and telling them only at 5 is a surprise.
 */
async function DailyAllowance() {
  const usage = await getInterviewUsage(await getViewer());
  if (!usage || usage.used < Math.ceil(usage.limit / 2)) return null;

  const left = Math.max(0, usage.limit - usage.used);

  return (
    <p className="mt-4 font-mono text-muted-foreground text-xs">
      {left === 0
        ? `Daily limit reached — ${usage.limit} of ${usage.limit} used. Resets at midnight UTC.`
        : `${left} of ${usage.limit} interviews left today.`}
    </p>
  );
}
