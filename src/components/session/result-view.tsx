import {
  CheckCircleIcon,
  MinusCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { DiscussPanel } from "@/components/session/discuss-panel";
import { RichText } from "@/components/session/rich-text";
import { DataLabel, Prose } from "@/components/ui/prose";
import type { AnswerKey, AnswerResponse } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { calibratedLevel, rungBreakdown } from "@/server/ai/adaptive";
import type { ClientQuestion } from "@/server/dal/dto";
import type { SessionDetail } from "@/server/dal/interview";

type Verdict = "correct" | "partial" | "incorrect";

/** A score is only meaningful next to what it says about the work. */
function verdictOf(score: number | null): Verdict | null {
  if (score === null) return null;
  if (score >= 80) return "correct";
  if (score >= 40) return "partial";
  return "incorrect";
}

const VERDICT = {
  correct: {
    Icon: CheckCircleIcon,
    label: "Correct",
    text: "text-correct",
    rule: "border-l-correct",
  },
  partial: {
    Icon: MinusCircleIcon,
    label: "Partly right",
    text: "text-partial",
    rule: "border-l-partial",
  },
  incorrect: {
    Icon: XCircleIcon,
    label: "Incorrect",
    text: "text-incorrect",
    rule: "border-l-incorrect",
  },
} as const;

/**
 * The review is ordered by what the reader has to do about it.
 *
 * Every question used to get an identical bordered card, so ten questions were
 * ten identical blocks and a question you got right shouted as loudly as one you
 * got wrong. The missed ones now come first and carry the full working; the
 * right ones collapse to a line each, because "you were right" is the whole
 * message and re-reading the explanation is not why anyone is here.
 */
export function ResultView({ session }: { session: SessionDetail }) {
  const weaknesses = collectWeaknesses(session.questions);

  const graded = session.questions.filter(
    (q) => q.answer?.score !== null && q.answer?.score !== undefined,
  );
  const missed = graded.filter(
    (q) => verdictOf(q.answer?.score ?? null) !== "correct",
  );
  const right = graded.filter(
    (q) => verdictOf(q.answer?.score ?? null) === "correct",
  );
  const ungraded = session.questions.filter(
    (q) => q.answer?.score === null || q.answer?.score === undefined,
  );

  return (
    <div className="space-y-14">
      <section className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <DataLabel>Score</DataLabel>
          <p className="font-display text-display-2xl tabular leading-none">
            {session.score === null ? "—" : `${formatScore(session.score)}%`}
          </p>
        </div>
        <div className="space-y-2 sm:pb-2">
          <Prose className="text-muted-foreground">
            <p>{summaryLine(session)}</p>
          </Prose>
          {session.adaptive ? <Calibration session={session} /> : null}
          {session.error ? (
            <p className="text-partial text-xs">{session.error}</p>
          ) : null}
        </div>
      </section>

      {weaknesses.length > 0 ? (
        <section className="space-y-3">
          <DataLabel as="h2">What to study next</DataLabel>
          <div className="flex flex-wrap gap-2">
            {weaknesses.map(({ concept, missed: n, total }) => (
              <span
                key={concept}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
              >
                {concept}
                <span className="font-mono text-[0.625rem] text-muted-foreground tabular">
                  {n}/{total} missed
                </span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {missed.length > 0 ? (
        <section className="space-y-5">
          <SectionRule
            title="What you missed"
            count={missed.length}
            note="The working is here. This is the part worth reading."
          />
          <ol className="space-y-4">
            {missed.map((q) => (
              <li key={q.id}>
                <MissedCard question={q} sessionId={session.id} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {right.length > 0 ? (
        <section className="space-y-5">
          <SectionRule title="What you got right" count={right.length} />
          <ol className="divide-y border-y">
            {right.map((q) => (
              <li key={q.id}>
                <RightRow question={q} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {ungraded.length > 0 ? (
        <section className="space-y-5">
          <SectionRule
            title="Not graded"
            count={ungraded.length}
            note="These couldn't be graded and are not counted in your score."
          />
          <ol className="divide-y border-y">
            {ungraded.map((q) => (
              <li key={q.id}>
                <RightRow question={q} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Adaptive sessions move the rung under the student as they go, so a single
 * score hides how hard the questions they answered actually were. This reads the
 * per-question rungs back out and reports the level they held, plus the raw
 * per-rung tally so the number is auditable.
 */
function Calibration({ session }: { session: SessionDetail }) {
  const answered = session.questions
    .filter((q) => q.answer?.score !== null && q.answer?.score !== undefined)
    .map((q) => ({
      rung: q.difficulty ?? session.difficulty,
      correct: verdictOf(q.answer?.score ?? null) === "correct",
    }));

  const level = calibratedLevel(answered);
  if (!level) return null;

  const breakdown = rungBreakdown(answered);

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1">
      <span className="text-sm">
        Calibrated level{" "}
        <span className="font-medium">{level.toLowerCase()}</span>
      </span>
      {breakdown.length ? (
        <span className="font-mono text-[0.625rem] text-muted-foreground tabular">
          {breakdown
            .map((b) => `${b.rung} ${b.correct}/${b.answered}`)
            .join(" · ")}
        </span>
      ) : null}
    </div>
  );
}

function SectionRule({
  title,
  count,
  note,
}: {
  title: string;
  count: number;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3">
      <DataLabel as="h2">{title}</DataLabel>
      <span className="font-mono text-[0.625rem] text-muted-foreground tabular">
        {count}
      </span>
      {note ? (
        <span className="text-muted-foreground text-xs">{note}</span>
      ) : null}
    </div>
  );
}

/** A question worth re-reading: question, both answers, the reason, the tags. */
function MissedCard({
  question,
  sessionId,
}: {
  question: ClientQuestion;
  sessionId: string;
}) {
  const verdict = verdictOf(question.answer?.score ?? null) ?? "incorrect";
  const meta = VERDICT[verdict];

  return (
    <article className={cn("border border-l-2 p-5 sm:p-6", meta.rule)}>
      <header className="mb-5 flex items-start justify-between gap-4">
        <Prose className="font-display text-xl leading-snug">
          <RichText>{question.prompt}</RichText>
        </Prose>
        <Verdict verdict={verdict} />
      </header>

      {/* Both answers side by side: the comparison is the point, and reading it
          as two stacked label/value rows made every card twice as tall. */}
      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <DataLabel as="dt">Your answer</DataLabel>
          <div className={cn("text-sm leading-relaxed", meta.text)}>
            {renderResponse(question, question.answer?.response ?? null)}
          </div>
        </div>
        <div className="space-y-1.5">
          <DataLabel as="dt">Correct answer</DataLabel>
          <div className="text-correct text-sm leading-relaxed">
            {renderKey(question, question.answerKey)}
          </div>
        </div>
      </div>

      {question.answer?.feedback ? (
        <div className="mt-4 border-t pt-4">
          <DataLabel as="dt">Feedback</DataLabel>
          <Prose className="mt-1.5 text-sm">
            <RichText>{question.answer.feedback}</RichText>
          </Prose>
        </div>
      ) : null}

      {question.explanation ? (
        <div className="mt-4 border-t pt-4">
          <DataLabel as="dt">Why</DataLabel>
          <Prose className="mt-1.5 text-muted-foreground text-sm">
            <RichText>{question.explanation}</RichText>
          </Prose>
        </div>
      ) : null}

      {question.concepts?.length ? (
        <p className="mt-4 flex flex-wrap gap-1.5">
          {question.concepts.map((c) => (
            <span
              key={c}
              className="rounded border px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </p>
      ) : null}

      <DiscussPanel sessionId={sessionId} questionId={question.id} />
    </article>
  );
}

/** One line. You were right; there is nothing to fix. */
function RightRow({ question }: { question: ClientQuestion }) {
  const verdict = verdictOf(question.answer?.score ?? null);
  const meta = verdict ? VERDICT[verdict] : null;
  const Icon = meta?.Icon ?? MinusCircleIcon;

  return (
    <div className="flex items-start gap-3 py-3">
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          meta ? meta.text : "text-muted-foreground",
        )}
        weight="fill"
      />
      {/* The tick is decorative; the verdict has to survive without it. */}
      <span className="sr-only">{meta ? meta.label : "Not graded"}: </span>
      <Prose className="flex-1 text-sm leading-relaxed">
        <RichText>{question.prompt}</RichText>
      </Prose>
      <span className="hidden shrink-0 text-muted-foreground text-xs sm:block">
        {shortAnswer(question.answer?.response ?? null)}
      </span>
    </div>
  );
}

function Verdict({ verdict }: { verdict: Verdict }) {
  const meta = VERDICT[verdict];
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs">
      <meta.Icon
        aria-hidden
        className={cn("size-4", meta.text)}
        weight="fill"
      />
      <span className="font-medium">{meta.label}</span>
    </span>
  );
}

/** The compact form for a row — the full text would wrap and defeat the point. */
function shortAnswer(response: AnswerResponse | null) {
  if (!response) return "—";
  if (response.kind === "TRUE_FALSE") return response.value ? "True" : "False";
  if (response.kind === "MCQ") return response.key.toUpperCase();
  return null;
}

function renderResponse(
  question: ClientQuestion,
  response: AnswerResponse | null,
) {
  if (!response)
    return <span className="text-muted-foreground">No answer</span>;

  if (response.kind === "MCQ") {
    const choice = question.choices?.find(
      (c) => c.key.toLowerCase() === response.key.toLowerCase(),
    );
    return choice ? (
      <RichText>{`${choice.key}. ${choice.text}`}</RichText>
    ) : (
      response.key
    );
  }
  if (response.kind === "TRUE_FALSE") return response.value ? "True" : "False";
  return response.text.trim() ? (
    <RichText>{response.text}</RichText>
  ) : (
    <span className="text-muted-foreground">Blank</span>
  );
}

function renderKey(question: ClientQuestion, key: AnswerKey | null) {
  if (!key) return <span className="text-muted-foreground">—</span>;

  if (key.kind === "MCQ") {
    const choice = question.choices?.find(
      (c) => c.key.toLowerCase() === key.key.toLowerCase(),
    );
    return choice ? (
      <RichText>{`${choice.key}. ${choice.text}`}</RichText>
    ) : (
      key.key
    );
  }
  if (key.kind === "TRUE_FALSE") return key.value ? "True" : "False";
  return <RichText>{key.expected}</RichText>;
}

function formatScore(score: number): string {
  // Trailing ".00" on a grade reads as false precision.
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function summaryLine(session: SessionDetail): string {
  const graded = session.questions.filter((q) => q.answer?.score !== null);
  const right = graded.filter((q) => (q.answer?.score ?? 0) >= 80).length;

  if (graded.length === 0) return "This session couldn't be graded.";
  if (right === graded.length) {
    return `Every question right on ${session.topic}. Try HARD next.`;
  }
  if (right === 0) {
    return `A rough one on ${session.topic}. The breakdown below shows exactly where it went wrong.`;
  }
  return `${right} of ${graded.length} right on ${session.topic}.`;
}

function collectWeaknesses(questions: ClientQuestion[]) {
  const byConcept = new Map<string, { missed: number; total: number }>();

  for (const question of questions) {
    const score = question.answer?.score;
    if (score === null || score === undefined) continue;

    for (const concept of question.concepts ?? []) {
      const entry = byConcept.get(concept) ?? { missed: 0, total: 0 };
      entry.total++;
      if (score < 80) entry.missed++;
      byConcept.set(concept, entry);
    }
  }

  return [...byConcept.entries()]
    .filter(([, v]) => v.missed > 0)
    .map(([concept, v]) => ({ concept, ...v }))
    .sort((a, b) => b.missed - a.missed || b.total - a.total)
    .slice(0, 6);
}
