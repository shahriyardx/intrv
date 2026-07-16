import { PulseIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CacheRatioChart,
  ChartCard,
  RankedBars,
  SpendChart,
} from "@/components/admin/charts";
import {
  formatCount,
  formatMs,
  formatPercent,
  formatTokens,
  formatUsd,
} from "@/components/admin/format";
import { SectionHeading } from "@/components/admin/section-heading";
import { StatRow, StatTile } from "@/components/analytics/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { type AiUsage, getAdminViewer, getAiUsage } from "@/server/dal/admin";

/** Neutral for non-admins — see the note in (admin)/admin/page.tsx. */
export async function generateMetadata(): Promise<Metadata> {
  const admin = await getAdminViewer();
  if (!admin) return {};
  return { title: "AI usage · Admin", robots: { index: false, follow: false } };
}

/**
 * Cache hits cost ~50x less than misses, so the hit ratio *is* the bill. It
 * only stays high while the prompt prefix is byte-stable: put anything that
 * varies per request near the front of a prompt and the ratio falls off a
 * cliff the same day. Comparing today against the days before it is what makes
 * that visible before the invoice does.
 */
function detectCacheCollapse(
  usage: AiUsage,
): { today: number; baseline: number } | null {
  const withPrompt = usage.days
    .map((day) => ({
      day: day.day,
      prompt: day.cacheHitTokens + day.cacheMissTokens,
      hits: day.cacheHitTokens,
    }))
    .filter((day) => day.prompt > 0);

  const today = withPrompt.at(-1);
  const before = withPrompt.slice(0, -1);
  if (!today || before.length < 3) return null;

  const priorPrompt = before.reduce((sum, day) => sum + day.prompt, 0);
  if (priorPrompt === 0) return null;

  const baseline = before.reduce((sum, day) => sum + day.hits, 0) / priorPrompt;
  const current = today.hits / today.prompt;

  // Two thirds of the established ratio: past normal drift, short of noise on a
  // quiet day.
  return baseline > 0.2 && current < baseline * 0.66
    ? { today: current, baseline }
    : null;
}

export default async function AdminAiUsagePage() {
  const admin = await getAdminViewer();
  if (!admin) notFound();

  const usage = await getAiUsage(14);

  if (usage.totals.calls === 0) {
    return (
      <div className="space-y-6">
        <SectionHeading label="Last 14 days" title="AI usage" />
        <EmptyState
          icon={<PulseIcon weight="duotone" />}
          title="No AI calls in the last 14 days"
          description="Every DeepSeek request is logged here with its cost, latency and cache split. Generate an interview and this fills in."
        />
      </div>
    );
  }

  const collapse = detectCacheCollapse(usage);
  const failureRate = usage.totals.calls
    ? usage.failures.reduce((sum, row) => sum + row.calls, 0) /
      usage.totals.calls
    : null;

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <SectionHeading label="Last 14 days" title="AI usage" />
        <StatRow>
          <StatTile
            label="Spend"
            value={formatUsd(usage.totals.costUsd)}
            note={`${formatCount(usage.totals.calls)} calls`}
          />
          <StatTile
            label="Cache hit ratio"
            value={formatPercent(usage.totals.cacheHitRatio)}
            note={`${formatTokens(usage.totals.cacheHitTokens)} hit · ${formatTokens(usage.totals.cacheMissTokens)} miss`}
            tone={collapse ? "warning" : "default"}
          />
          <StatTile
            label="Latency p50 / p95"
            value={`${formatMs(usage.latency.p50)} / ${formatMs(usage.latency.p95)}`}
            note="Successful calls only"
          />
          <StatTile
            label="Failures"
            value={formatPercent(failureRate, 1)}
            note={
              usage.failures.length === 0
                ? "Nothing failed"
                : `${usage.failures.length} distinct error codes`
            }
            tone={(failureRate ?? 0) > 0.05 ? "warning" : "default"}
          />
        </StatRow>

        {collapse ? (
          <p className="flex items-start gap-2 border border-partial/40 bg-partial-muted px-4 py-3 text-xs">
            <WarningIcon
              className="mt-0.5 size-4 shrink-0 text-partial"
              weight="fill"
            />
            <span>
              <strong className="font-medium">
                Cache hit ratio collapsed.
              </strong>{" "}
              Today is {formatPercent(collapse.today)} against a{" "}
              {formatPercent(collapse.baseline)} baseline. Something in front of
              the prompt started varying per request — check the prompt prefix
              order in src/server/ai/prompts.ts. Misses cost ~50x hits.
            </span>
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          label="Daily"
          title="Spend"
          description="One bar per day, in USD."
        >
          <SpendChart days={usage.days} />
        </ChartCard>

        <ChartCard
          label="Daily"
          title="Cache hit ratio"
          description="Share of prompt tokens served from the prefix cache. Gaps are days with no calls."
        >
          <CacheRatioChart days={usage.days} />
        </ChartCard>

        <ChartCard
          label="Cost"
          title="By model"
          description="Spend attributed to each model id."
        >
          <RankedBars
            colorVar="--chart-1"
            rows={usage.byModel.map((row) => ({
              label: row.model,
              value: row.costUsd,
              display: formatUsd(row.costUsd),
              note: `${formatCount(row.calls)} calls`,
            }))}
          />
          <div className="mt-8">
            <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
              By purpose
            </p>
            <RankedBars
              colorVar="--chart-7"
              rows={usage.byPurpose.map((row) => ({
                label: row.purpose,
                value: row.costUsd,
                display: formatUsd(row.costUsd),
                note: `${formatCount(row.calls)} calls`,
              }))}
            />
          </div>
        </ChartCard>

        <ChartCard
          label="Reliability"
          title="Failures by error code"
          description="Failed calls in the window, grouped by the code we recorded."
        >
          {usage.failures.length === 0 ? (
            <EmptyState
              title="No failures"
              description="Every AI call in the last 14 days came back ok."
            />
          ) : (
            <RankedBars
              colorVar="--chart-8"
              rows={usage.failures.map((row) => ({
                label: row.errorCode,
                value: row.calls,
                display: formatCount(row.calls),
              }))}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
