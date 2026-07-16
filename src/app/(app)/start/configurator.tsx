"use client";

import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataLabel } from "@/components/ui/prose";
import {
  DIFFICULTIES,
  type Difficulty,
  QUESTION_COUNTS,
  QUESTION_TYPES,
  type QuestionType,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { createInterviewSession } from "@/server/actions/interview";

const TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: "Multiple choice",
  TRUE_FALSE: "True / false",
  SHORT_ANSWER: "Short answer",
};

const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  EASY: "Just read an intro",
  MEDIUM: "Know the pitfalls",
  HARD: "Reason about trade-offs",
};

const TIME_OPTIONS = [
  { label: "Untimed", value: "" },
  { label: "5 min", value: "5" },
  { label: "10 min", value: "10" },
  { label: "20 min", value: "20" },
  { label: "45 min", value: "45" },
];

const SUGGESTIONS = [
  "React hooks",
  "SQL indexing",
  "Distributed systems",
  "Cell biology",
  "Behavioural interview",
];

export function Configurator() {
  const [state, formAction, pending] = useActionState(
    createInterviewSession,
    null,
  );

  return (
    <form action={formAction} className="space-y-10">
      <Field label="Topic" hint="Anything you want to be tested on.">
        <Input
          name="topic"
          required
          maxLength={120}
          autoFocus
          placeholder="e.g. React hooks, photosynthesis, system design"
          className="h-12 text-base"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              onClick={(e) => {
                const input = e.currentTarget
                  .closest("form")
                  ?.querySelector<HTMLInputElement>('input[name="topic"]');
                if (input) input.value = s;
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Question types" hint="Pick at least one.">
        <div className="grid gap-2 sm:grid-cols-3">
          {QUESTION_TYPES.map((type) => (
            <label key={type} className="cursor-pointer">
              <input
                type="checkbox"
                name="types"
                value={type}
                defaultChecked
                className="peer sr-only"
              />
              <div className="rounded-md border p-3 text-sm transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {TYPE_LABELS[type]}
              </div>
            </label>
          ))}
        </div>
      </Field>

      <div className="grid gap-10 sm:grid-cols-2">
        <Field label="Difficulty">
          <div className="grid gap-2">
            {DIFFICULTIES.map((d, i) => (
              <label key={d} className="cursor-pointer">
                <input
                  type="radio"
                  name="difficulty"
                  value={d}
                  defaultChecked={i === 1}
                  className="peer sr-only"
                />
                <div className="flex items-baseline justify-between rounded-md border px-3 py-2 text-sm transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  <span className="capitalize">{d.toLowerCase()}</span>
                  <span className="text-xs text-muted-foreground">
                    {DIFFICULTY_HINTS[d]}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </Field>

        <div className="space-y-10">
          <Field label="Questions">
            <div className="flex gap-2">
              {QUESTION_COUNTS.map((n, i) => (
                <label key={n} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="questionCount"
                    value={n}
                    defaultChecked={i === 1}
                    className="peer sr-only"
                  />
                  <div className="rounded-md border py-2 text-center font-mono text-sm tabular transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    {n}
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Time limit">
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((opt, i) => (
                <label key={opt.label} className="cursor-pointer">
                  <input
                    type="radio"
                    name="timeLimitMinutes"
                    value={opt.value}
                    defaultChecked={i === 0}
                    className="peer sr-only"
                  />
                  <div className="rounded-md border px-3 py-2 text-xs transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    {opt.label}
                  </div>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending} className="min-w-44">
          {pending ? (
            <>
              <SpinnerGapIcon className="size-4 animate-spin" />
              Preparing…
            </>
          ) : (
            "Start interview"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          No account needed. Sign up later to keep your history.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between">
        <Label asChild>
          <DataLabel>{label}</DataLabel>
        </Label>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
