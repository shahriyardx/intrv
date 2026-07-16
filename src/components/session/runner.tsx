"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  SpinnerGapIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { QuestionCard } from "@/components/session/question-card";
import { Timer } from "@/components/session/timer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataLabel } from "@/components/ui/prose";
import type { AnswerResponse, QuestionType } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { saveAnswer, submitSession } from "@/server/actions/interview";
import { useTRPC } from "@/trpc/client";

type Props = {
  sessionId: string;
  types: QuestionType[];
  expectedCount: number;
  expiresAt: string | null;
  /**
   * SCREEN sessions only: count focus-loss and paste events and report them at
   * submit. Regular practice never records this — there is no reader for it.
   */
  trackIntegrity?: boolean;
  /**
   * Adaptive sessions deliver questions in rung-sized batches and pause to grade
   * the last batch before writing the next. The user reaches the final arrived
   * question while more are legitimately locked, so the wait needs explaining as
   * "answer to unlock" rather than "the model is slow".
   */
  adaptive?: boolean;
};

export function Runner({
  sessionId,
  types,
  expectedCount,
  expiresAt,
  trackIntegrity = false,
  adaptive = false,
}: Props) {
  const trpc = useTRPC();

  // Generator query: `data` grows as DeepSeek produces questions, so the first
  // question is answerable long before the last one exists.
  const { data, status, error } = useQuery(
    trpc.interview.generate.queryOptions(
      { sessionId, types },
      {
        trpc: { context: { stream: true } },
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    ),
  );

  const questions = data ?? [];
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerResponse>>({});
  const [submitting, startSubmit] = useTransition();
  const submittedRef = useRef(false);

  const question = questions[current];
  const answeredCount = Object.keys(answers).length;
  const allArrived = questions.length >= expectedCount;

  // Active time per question, summed across visits. The clock pauses while the
  // tab is hidden, so it approximates thinking time, not wall time. Client
  // numbers — analytics-grade only, the server clamps them.
  const timesRef = useRef<Record<string, number>>({});
  const enteredAtRef = useRef<number | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const integrityRef = useRef({ blurs: 0, pastes: 0 });

  const flushTime = useCallback(() => {
    const id = currentIdRef.current;
    if (id && enteredAtRef.current !== null) {
      timesRef.current[id] =
        (timesRef.current[id] ?? 0) + (Date.now() - enteredAtRef.current);
      enteredAtRef.current = Date.now();
    }
  }, []);

  const questionId = question?.id ?? null;
  useEffect(() => {
    flushTime();
    currentIdRef.current = questionId;
    enteredAtRef.current = questionId ? Date.now() : null;
  }, [questionId, flushTime]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        flushTime();
        enteredAtRef.current = null;
      } else if (currentIdRef.current) {
        enteredAtRef.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (!trackIntegrity) {
      return () =>
        document.removeEventListener("visibilitychange", onVisibility);
    }

    const onBlur = () => {
      integrityRef.current.blurs++;
    };
    const onPaste = () => {
      integrityRef.current.pastes++;
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("paste", onPaste);
    };
  }, [flushTime, trackIntegrity]);

  const onAnswer = useCallback(
    (response: AnswerResponse) => {
      if (!question) return;
      setAnswers((prev) => ({ ...prev, [question.id]: response }));
      flushTime();

      // Fire-and-forget autosave: the user should never wait on it, but a
      // failure must not be silent or they lose work without knowing.
      void saveAnswer({
        sessionId,
        questionId: question.id,
        response,
        timeMs: timesRef.current[question.id],
      }).then((r) => {
        if (!r.ok) toast.error(r.error);
      });
    },
    [question, sessionId, flushTime],
  );

  const doSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    flushTime();
    startSubmit(async () => {
      const result = await submitSession(
        sessionId,
        trackIntegrity ? { ...integrityRef.current } : undefined,
      );
      // submitSession redirects on success, so anything returned is a failure.
      if (result && !result.ok) {
        submittedRef.current = false;
        toast.error(result.error);
      }
    });
  }, [sessionId, flushTime, trackIntegrity]);

  const onExpire = useCallback(() => {
    if (submittedRef.current) return;
    toast.info("Time's up — submitting your answers.");
    doSubmit();
  }, [doSubmit]);

  if (status === "error") {
    return (
      <Alert
        title="We couldn't generate this interview"
        body={
          error instanceof Error && error.message
            ? "The topic may be too narrow, or the service is busy. Try again or rephrase it."
            : "Something went wrong."
        }
      />
    );
  }

  if (!question) {
    return <GeneratingState expectedCount={expectedCount} />;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <DataLabel>
            Question {current + 1} /{" "}
            {allArrived ? questions.length : expectedCount}
          </DataLabel>
          <div className="flex items-center gap-4">
            {!allArrived ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <SpinnerGapIcon className="size-3 animate-spin" />
                {adaptive
                  ? "adapting to your level"
                  : `writing ${questions.length}/${expectedCount}`}
              </span>
            ) : null}
            {expiresAt ? (
              <Timer expiresAt={new Date(expiresAt)} onExpire={onExpire} />
            ) : null}
          </div>
        </div>
        <Progress value={((current + 1) / Math.max(expectedCount, 1)) * 100} />
      </div>

      <div key={question.id} className="animate-rise">
        <QuestionCard
          question={question}
          value={answers[question.id] ?? null}
          onChange={onAnswer}
          disabled={submitting}
        />
      </div>

      {adaptive && !allArrived && current === questions.length - 1 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
          Answer these to unlock the next questions — difficulty adapts to how
          you're doing.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t pt-6">
        <Button
          variant="ghost"
          onClick={() => setCurrent((i) => Math.max(0, i - 1))}
          disabled={current === 0 || submitting}
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>

        <span className="text-xs text-muted-foreground">
          {answeredCount} of {expectedCount} answered
        </span>

        {current < questions.length - 1 ? (
          <Button
            onClick={() => setCurrent((i) => i + 1)}
            disabled={submitting}
          >
            Next
            <ArrowRightIcon className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={doSubmit}
            // Submitting before every question exists would score the missing
            // ones as blanks.
            disabled={submitting || !allArrived}
            className="min-w-36"
          >
            {submitting ? (
              <>
                <SpinnerGapIcon className="size-4 animate-spin" />
                Grading…
              </>
            ) : (
              "Submit & grade"
            )}
          </Button>
        )}
      </div>

      {questions.length > 1 ? (
        <nav aria-label="Questions" className="flex flex-wrap gap-1.5">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              aria-label={`Go to question ${i + 1}${answers[q.id] ? " (answered)" : ""}`}
              aria-current={i === current}
              onClick={() => setCurrent(i)}
              className={cn(
                "size-7 rounded font-mono text-[0.625rem] tabular transition-colors",
                i === current
                  ? "bg-foreground text-background"
                  : answers[q.id]
                    ? "bg-accent/25 text-foreground hover:bg-accent/40"
                    : "border text-muted-foreground hover:border-foreground/40",
              )}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function GeneratingState({ expectedCount }: { expectedCount: number }) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
      <SpinnerGapIcon className="size-6 animate-spin text-muted-foreground" />
      <p className="font-display text-display-md">
        Writing your questions{".".repeat(dots)}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {expectedCount} questions, written for your topic. The first ones appear
        in a few seconds — you can start before the rest arrive.
      </p>
    </div>
  );
}

function Alert({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
      <WarningIcon className="size-6 text-destructive" weight="fill" />
      <p className="font-display text-display-md">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      <Button asChild variant="outline" className="mt-2">
        <a href="/start">Start over</a>
      </Button>
    </div>
  );
}
