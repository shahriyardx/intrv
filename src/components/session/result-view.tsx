import {
  CheckCircleIcon,
  MinusCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { RichText } from "@/components/session/rich-text";
import { Badge } from "@/components/ui/badge";
import { DataLabel, Prose } from "@/components/ui/prose";
import type { AnswerKey, AnswerResponse } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { ClientQuestion } from "@/server/dal/dto";
import type { SessionDetail } from "@/server/dal/interview";

/** A score is only meaningful next to what it says about the work. */
function verdictOf(
  score: number | null,
): "correct" | "partial" | "incorrect" | null {
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
    bg: "bg-correct-muted",
  },
  partial: {
    Icon: MinusCircleIcon,
    label: "Partly right",
    text: "text-partial",
    bg: "bg-partial-muted",
  },
  incorrect: {
    Icon: XCircleIcon,
    label: "Incorrect",
    text: "text-incorrect",
    bg: "bg-incorrect-muted",
  },
} as const;

export function ResultView({ session }: { session: SessionDetail }) {
  const weaknesses = collectWeaknesses(session.questions);

  return (
    <div className="space-y-12">
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
          {session.error ? (
            <p className="text-xs text-partial">{session.error}</p>
          ) : null}
        </div>
      </section>

      {weaknesses.length > 0 ? (
        <section className="space-y-3">
          <DataLabel>What to study next</DataLabel>
          <div className="flex flex-wrap gap-2">
            {weaknesses.map(({ concept, missed, total }) => (
              <span
                key={concept}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
              >
                {concept}
                <span className="font-mono text-[0.625rem] tabular text-muted-foreground">
                  {missed}/{total} missed
                </span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <DataLabel>Every question</DataLabel>
        <ol className="space-y-4">
          {session.questions.map((q) => (
            <li key={q.id}>
              <ReviewCard question={q} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ReviewCard({ question }: { question: ClientQuestion }) {
  const verdict = verdictOf(question.answer?.score ?? null);
  const meta = verdict ? VERDICT[verdict] : null;

  return (
    <article className="rounded-md border p-5">
      <header className="mb-4 flex items-start justify-between gap-4">
        <Prose className="font-medium">
          <RichText>{question.prompt}</RichText>
        </Prose>
        {meta ? (
          // Icon + label, never colour alone.
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs",
              meta.bg,
            )}
          >
            <meta.Icon className={cn("size-4", meta.text)} weight="fill" />
            <span className="font-medium">{meta.label}</span>
          </span>
        ) : (
          <Badge variant="outline" className="shrink-0 text-[0.625rem]">
            Not graded
          </Badge>
        )}
      </header>

      <dl className="space-y-3 text-sm">
        <Row label="Your answer">
          {renderResponse(question, question.answer?.response ?? null)}
        </Row>
        {verdict !== "correct" ? (
          <Row label="Correct answer">
            {renderKey(question, question.answerKey)}
          </Row>
        ) : null}
        {question.answer?.feedback ? (
          <Row label="Feedback">
            <RichText>{question.answer.feedback}</RichText>
          </Row>
        ) : null}
        {question.explanation ? (
          <Row label="Why">
            <RichText>{question.explanation}</RichText>
          </Row>
        ) : null}
      </dl>
    </article>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-4">
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-pretty leading-relaxed">{children}</dd>
    </div>
  );
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
