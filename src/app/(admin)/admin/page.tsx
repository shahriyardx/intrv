import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartCard, SpendChart } from "@/components/admin/charts";
import {
  formatCount,
  formatPercent,
  formatUsd,
} from "@/components/admin/format";
import { SectionHeading } from "@/components/admin/section-heading";
import { StatRow, StatTile } from "@/components/analytics/stat-tile";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getAdminViewer, getAiUsage, getOverview } from "@/server/dal/admin";

/**
 * The static shell — <title> included — is built before the gate below runs and
 * is served to anyone who asks. A title naming this surface would confirm to an
 * anonymous probe that /admin exists, which is precisely what notFound() is
 * withholding. Non-admins get {} and inherit the root title, like any 404.
 */
export async function generateMetadata(): Promise<Metadata> {
  const admin = await getAdminViewer();
  if (!admin) return {};
  return { title: "Admin", robots: { index: false, follow: false } };
}

export default async function AdminOverviewPage() {
  // The layout's check does not protect this page: layouts don't re-run on
  // every navigation and can't be relied on as a boundary. Each page asks.
  const admin = await getAdminViewer();
  if (!admin) notFound();

  const [overview, usage] = await Promise.all([getOverview(), getAiUsage(14)]);

  const failing = (overview.failureRate ?? 0) > 0.05;

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        {/* "All time" because three of these four tiles are unwindowed counts.
            The AI failure rate is the exception and says so on the tile. */}
        <SectionHeading label="All time" title="Where things stand" />
        <StatRow>
          <StatTile label="Users" value={formatCount(overview.users)} />
          <StatTile
            label="Sessions"
            value={formatCount(overview.sessions)}
            note={`${formatCount(overview.gradedSessions)} graded`}
          />
          <StatTile
            label="Completion"
            value={formatPercent(overview.completionRate)}
            note="Sessions that reached a grade"
          />
          <StatTile
            label="AI failures"
            value={formatPercent(overview.failureRate, 1)}
            note={`of ${formatCount(overview.calls30d)} calls · last 30 days`}
            tone={failing ? "warning" : "default"}
          />
        </StatRow>
      </section>

      <section className="space-y-6">
        <SectionHeading label="AI spend" title="What it costs">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/ai-usage">Break it down</Link>
          </Button>
        </SectionHeading>

        <StatRow>
          <StatTile label="Today" value={formatUsd(overview.spendToday)} />
          <StatTile label="Last 7 days" value={formatUsd(overview.spend7d)} />
          <StatTile label="Last 30 days" value={formatUsd(overview.spend30d)} />
          <StatTile
            label="Cache hit ratio"
            value={formatPercent(usage.totals.cacheHitRatio)}
            note="Hits cost ~50x less than misses"
          />
        </StatRow>

        {failing ? (
          <p className="flex items-center gap-2 border border-partial/40 bg-partial-muted px-4 py-3 text-xs">
            <WarningIcon
              className="size-4 shrink-0 text-partial"
              weight="fill"
            />
            <span>
              {formatPercent(overview.failureRate, 1)} of AI calls failed in the
              last 30 days.{" "}
              <Link href="/admin/ai-usage" className="underline">
                See the error codes
              </Link>
              .
            </span>
          </p>
        ) : null}

        {usage.totals.calls === 0 ? (
          <EmptyState
            title="No AI calls in the last 14 days"
            description="Spend appears here once someone generates an interview."
          />
        ) : (
          <ChartCard
            label="Daily"
            title="Spend, last 14 days"
            description="One bar per day, in USD."
          >
            <SpendChart days={usage.days} />
          </ChartCard>
        )}
      </section>
    </div>
  );
}
