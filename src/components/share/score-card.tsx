import { DataLabel } from "@/components/ui/prose";
import type { SharedSession } from "@/server/dal/share";
import { CopyBadgeButton } from "./copy-badge-button";

/**
 * The verified score card that heads a public shared result.
 *
 * The whole point is typographic honesty: this number was graded here, not
 * typed into a screenshot. So there is no seal or crest — just a hairline
 * frame, the score set in the display face, and a quiet "Verified result ·
 * Intrv" mark. The frame (a full border plus an accent hairline along the top)
 * is what sets the block apart from the review below it.
 */
export function ScoreCard({ session }: { session: SharedSession }) {
  const score = session.score === null ? null : formatScore(session.score);

  return (
    <section className="print-card overflow-hidden rounded-md border border-t-0">
      {/* The one place the accent is spent on this page — a highlighter rule
          across the top edge, the same signal as the header dot. */}
      <div aria-hidden className="h-0.5 w-full bg-accent" />

      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <VerifiedMark />
          <CopyBadgeButton
            shareId={session.shareId}
            topic={session.topic}
            difficulty={session.difficulty}
            score={score}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-2">
          <p className="font-display text-display-2xl tabular leading-none">
            {score === null ? "—" : `${score}%`}
          </p>
          <div className="pb-1">
            <p className="font-display text-display-md leading-tight">
              {session.topic}
            </p>
            {session.takerName ? (
              <p className="mt-0.5 text-muted-foreground text-sm">
                by {session.takerName}
              </p>
            ) : null}
          </div>
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4">
          <Fact label="Difficulty" value={session.difficulty.toLowerCase()} />
          <Fact label="Questions" value={String(session.questionCount)} />
          <Fact label="Taken" value={formatDate(session.createdAt)} />
          <Fact
            label="Mode"
            value={session.mode.toLowerCase().replace(/_/g, " ")}
          />
        </dl>
      </div>
    </section>
  );
}

/** "Verified result · Intrv" — the wordmark, borrowed from the site header. */
function VerifiedMark() {
  return (
    <div className="flex items-baseline gap-1.5">
      <DataLabel>Verified result</DataLabel>
      <span aria-hidden className="text-muted-foreground text-xs">
        ·
      </span>
      <span className="flex items-baseline gap-1">
        <span className="font-display text-sm tracking-tight">Intrv</span>
        <span
          aria-hidden
          className="size-1 rounded-full bg-accent"
          // Baseline-align the dot with the wordmark's x-height.
          style={{ transform: "translateY(-1px)" }}
        />
      </span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <DataLabel as="dt">{label}</DataLabel>
      <dd className="font-mono text-sm tabular">{value}</dd>
    </div>
  );
}

function formatScore(score: number): string {
  // Trailing ".00" on a grade reads as false precision.
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}
