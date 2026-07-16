import {
  ArrowSquareOutIcon,
  MinusCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { format } from "date-fns";
import Link from "next/link";
import type { ReactNode } from "react";
import { RichText } from "@/components/session/rich-text";
import { DataLabel, Prose } from "@/components/ui/prose";
import type { AnswerKey, AnswerResponse } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { Mistake } from "@/server/dal/analytics";
import type { ClientQuestion } from "@/server/dal/dto";

/**
 * One wrong answer, turned into something you can study: what was asked, what
 * they said, what the answer actually is, and why.
 *
 * Only ever built from GRADED sessions, where toClientQuestion() has already
 * decided the key and explanation may be revealed. If those come through null,
 * the session wasn't graded and the card says so instead of rendering a blank
 * "Correct answer" row.
 */
export function MistakeCard({ mistake }: { mistake: Mistake }) {
  const { question } = mistake;
  const score = question.answer?.score ?? 0;
  const partial = score >= 40;

  const verdict = partial
    ? {
        Icon: MinusCircleIcon,
        label: "Partly right",
        text: "text-partial",
        bg: "bg-partial-muted",
      }
    : {
        Icon: XCircleIcon,
        label: "Incorrect",
        text: "text-incorrect",
        bg: "bg-incorrect-muted",
      };

  return (
    <article className="rounded-md border p-5">
      <header className="mb-4 flex items-start justify-between gap-4">
        <Prose className="font-medium">
          <RichText>{question.prompt}</RichText>
        </Prose>
        {/* Icon + label + score. Never colour alone. */}
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs",
            verdict.bg,
          )}
        >
          <verdict.Icon className={cn("size-4", verdict.text)} weight="fill" />
          <span className="font-medium">{verdict.label}</span>
          <span className="font-mono tabular text-[0.625rem]">
            {Math.round(score)}%
          </span>
        </span>
      </header>

      <dl className="space-y-3 text-sm">
        <Row label="You said">
          {renderResponse(question, question.answer?.response ?? null)}
        </Row>
        <Row label="Answer">{renderKey(question, question.answerKey)}</Row>
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

      <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3">
        <DataLabel>{mistake.difficulty.toLowerCase()}</DataLabel>
        <Link
          href={`/s/${mistake.sessionId}/result`}
          className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {mistake.topic}
          <ArrowSquareOutIcon className="size-3" aria-hidden />
        </Link>
        {mistake.gradedAt ? (
          <span className="font-mono text-[0.625rem] tabular text-muted-foreground">
            {format(mistake.gradedAt, "d MMM yyyy")}
          </span>
        ) : null}
      </footer>
    </article>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:gap-4">
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

  return (
    <div className="space-y-2">
      <RichText>{key.expected}</RichText>
      {key.keyPoints.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
          {key.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
