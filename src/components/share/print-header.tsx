import { DataLabel } from "@/components/ui/prose";
import type { SessionDetail } from "@/server/dal/interview";

/**
 * A masthead that exists only on paper. On screen the page already has its own
 * heading and the sticky site header; neither prints (both are .no-print). So a
 * printed result would otherwise open with a bare score and no idea what it is
 * or where it came from. This is `print-only` — hidden on screen, shown by the
 * @media print block — and gives the sheet a title, the topic, the date, and
 * the score.
 */
export function PrintHeader({ session }: { session: SessionDetail }) {
  const score = session.score === null ? "—" : `${formatScore(session.score)}%`;

  return (
    <header className="print-only mb-8 hidden items-baseline justify-between gap-4 border-b pb-3">
      <div>
        <p className="font-display text-lg tracking-tight">
          Intrv — interview result
        </p>
        <p className="text-muted-foreground text-sm">
          {session.topic} · {formatDate(session.createdAt)}
        </p>
      </div>
      <div className="text-right">
        <DataLabel>Score</DataLabel>
        <p className="font-display text-2xl tabular leading-none">{score}</p>
      </div>
    </header>
  );
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}
