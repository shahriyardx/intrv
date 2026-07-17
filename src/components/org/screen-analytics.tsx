import {
  CheckCircleIcon,
  MinusCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { RankedBars } from "@/components/admin/charts";
import { ChartPanel } from "@/components/analytics/chart-panel";
import { questionTypeLabel, truncate } from "@/components/analytics/format";
import { DataLabel, Prose } from "@/components/ui/prose";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { QuestionStat, ScreenAnalytics } from "@/server/dal/org-analytics";

/**
 * How the cohort scored, and where any one candidate sits in it.
 *
 * A bare "72%" is unreadable on its own — it only becomes a decision next to
 * the distribution it came from. Below a handful of graded attempts the
 * distribution is noise, so we say so rather than draw five bars of one.
 */
export function ScoreDistribution({
  analytics,
}: {
  analytics: ScreenAnalytics;
}) {
  if (analytics.graded === 0) {
    return (
      <section className="space-y-2">
        <DataLabel as="h3">Score distribution</DataLabel>
        <p className="text-sm text-muted-foreground">
          Nothing graded yet. Scores appear here once candidates submit.
        </p>
      </section>
    );
  }

  const rows = analytics.distribution.map((bucket) => ({
    label: bucket.label,
    value: bucket.count,
    display: String(bucket.count),
    note: bucket.count === 1 ? "candidate" : "candidates",
  }));

  return (
    <ChartPanel
      title="Score distribution"
      description={
        analytics.graded < 5
          ? `Only ${analytics.graded} graded ${
              analytics.graded === 1 ? "attempt" : "attempts"
            } so far — read the shape once more candidates have taken it.`
          : "How the whole cohort scored. A screen where everyone lands in one band isn't separating candidates."
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Score band</TableHead>
              <TableHead className="text-right">Candidates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analytics.distribution.map((bucket) => (
              <TableRow key={bucket.label}>
                <TableCell className="font-mono text-xs">
                  {bucket.label}%
                </TableCell>
                <TableCell className="text-right font-mono tabular">
                  {bucket.count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <div className="space-y-6">
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <Figure label="p25" value={pct(analytics.p25)} />
          <Figure label="Median" value={pct(analytics.medianScore)} />
          <Figure label="p75" value={pct(analytics.p75)} />
        </dl>
        <RankedBars rows={rows} colorVar="--chart-1" />
      </div>
    </ChartPanel>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>
        <DataLabel>{label}</DataLabel>
      </dt>
      <dd className="mt-1 font-display text-display-md tabular leading-none">
        {value}
      </dd>
    </div>
  );
}

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

const VERDICT = {
  "no-signal": {
    Icon: MinusCircleIcon,
    label: "No signal",
    hint: "Nearly everyone passes — this question isn't separating anyone.",
    text: "text-partial",
    bg: "bg-partial-muted",
  },
  "too-hard": {
    Icon: WarningIcon,
    label: "Everyone fails",
    hint: "Almost nobody passes. Usually ambiguous rather than hard.",
    text: "text-incorrect",
    bg: "bg-incorrect-muted",
  },
  discriminates: {
    Icon: CheckCircleIcon,
    label: "Separates",
    hint: "Splits the cohort — this one is earning its slot.",
    text: "text-correct",
    bg: "bg-correct-muted",
  },
  insufficient: {
    Icon: MinusCircleIcon,
    label: "Too few",
    hint: "Not enough answers to judge this question yet.",
    text: "text-muted-foreground",
    bg: "bg-muted",
  },
} as const;

/**
 * Per-question pass rates — the part that makes the screen better rather than
 * just measuring candidates.
 *
 * A question nearly everyone passes is costing a slot without buying
 * information; one nearly everyone fails is usually ambiguous rather than hard.
 * Verdicts are withheld under a small sample: two of three candidates failing
 * says nothing, and sending someone off to rewrite a good question on that
 * basis would be worse than saying nothing.
 */
export function QuestionQuality({ questions }: { questions: QuestionStat[] }) {
  if (questions.length === 0) {
    return (
      <section className="space-y-2">
        <DataLabel as="h3">Question quality</DataLabel>
        <p className="text-sm text-muted-foreground">
          Once candidates have been graded, each question's pass rate shows up
          here — including which ones aren't telling you anything.
        </p>
      </section>
    );
  }

  const flagged = questions.filter(
    (q) => q.verdict === "no-signal" || q.verdict === "too-hard",
  ).length;

  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <DataLabel as="h3">Question quality</DataLabel>
        <Prose className="text-sm text-muted-foreground">
          <p>
            {flagged === 0
              ? "How often each question is answered correctly. Nothing looks broken."
              : `How often each question is answered correctly. ${flagged} ${
                  flagged === 1 ? "question is" : "questions are"
                } worth a look.`}
          </p>
        </Prose>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Question</TableHead>
            <TableHead className="text-right">Pass rate</TableHead>
            <TableHead className="text-right">Answered</TableHead>
            <TableHead>Reading</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((question) => {
            const meta = VERDICT[question.verdict];
            return (
              <TableRow key={question.index}>
                <TableCell className="font-mono text-muted-foreground text-xs tabular">
                  {question.index + 1}
                </TableCell>
                <TableCell className="max-w-80">
                  <span className="block truncate">
                    {truncate(question.prompt, 90)}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
                    {questionTypeLabel(question.type)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono tabular">
                    {question.passRate === null
                      ? "—"
                      : `${Math.round(question.passRate * 100)}%`}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground tabular">
                  {question.passed}/{question.answered}
                </TableCell>
                <TableCell>
                  {/* Icon and words, never colour alone. */}
                  <span
                    title={meta.hint}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.6875rem]",
                      meta.bg,
                    )}
                  >
                    <meta.Icon
                      aria-hidden
                      className={cn("size-3.5 shrink-0", meta.text)}
                      weight="fill"
                    />
                    {meta.label}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
