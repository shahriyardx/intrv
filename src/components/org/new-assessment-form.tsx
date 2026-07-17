"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DataLabel } from "@/components/ui/prose";
import {
  DIFFICULTIES,
  type Difficulty,
  QUESTION_TYPES,
  type QuestionType,
  questionTypeSchema,
} from "@/lib/schemas";
import { createAssessment } from "@/server/actions/org";

const TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: "Multiple choice",
  TRUE_FALSE: "True / false",
  SHORT_ANSWER: "Short answer",
};

const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  BEGINNER: "First day with it",
  EASY: "Just read an intro",
  MEDIUM: "Know the pitfalls",
  HARD: "Reason about trade-offs",
  EXPERT: "Shipped it in production",
};

const SCREEN_COUNTS = [5, 10, 15, 20] as const;
const SCREEN_TIMES = [10, 20, 30, 45] as const;

// Client-side mirror of createAssessmentSchema in the action — UX only; the action
// re-validates with its own schema, which stays the security boundary.
const schema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Give the assessment a title of at least 2 characters.")
    .max(120, "Keep the title under 120 characters."),
  topic: z
    .string()
    .trim()
    .min(2, "Give the topic at least 2 characters.")
    .max(120, "Keep the topic under 120 characters."),
  types: z
    .array(questionTypeSchema)
    .min(1, "Choose at least one question type."),
  difficulty: z.enum(DIFFICULTIES),
  // Radios carry strings; the server does Number(...). Validate the option set.
  questionCount: z.enum(SCREEN_COUNTS.map(String) as [string, ...string[]]),
  timeLimitMinutes: z.enum(SCREEN_TIMES.map(String) as [string, ...string[]]),
});

type Values = z.infer<typeof schema>;

/**
 * Generation is synchronous and can take a minute or two, so the pending state
 * has to be patient and explicit — a bare spinner would read as stuck. On
 * success the action redirects to the new assessment; it only returns here to
 * report an error.
 */
export function NewAssessmentForm({ orgId }: { orgId: string }) {
  // reactCompiler breaks RHF v7's formState Proxy subscription — opt out.
  "use no memo";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      topic: "",
      types: [...QUESTION_TYPES],
      difficulty: "MEDIUM",
      questionCount: "10",
      timeLimitMinutes: "20",
    },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("title", values.title);
      data.set("topic", values.topic);
      for (const type of values.types) data.append("types", type);
      data.set("difficulty", values.difficulty);
      data.set("questionCount", String(values.questionCount));
      data.set("timeLimitMinutes", String(values.timeLimitMinutes));
      // Success redirects (throws NEXT_REDIRECT); only an error object returns.
      const result = await createAssessment(orgId, null, data);
      if (result && !result.ok) setServerError(result.error);
    });
  });

  if (pending) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-14 text-center">
        <SpinnerGapIcon className="size-6 animate-spin text-muted-foreground" />
        <p className="font-display text-display-md">Writing the interview…</p>
        <p className="max-w-sm text-muted-foreground text-sm">
          We're generating and freezing the question set now. Every candidate
          answers this exact set, so it's written once — this takes up to a
          couple of minutes. Keep this tab open.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-10">
      <Field className="gap-3">
        <Row label="Title" hint="What candidates and your team will see.">
          <Input
            id="assessment-title"
            maxLength={120}
            autoFocus
            placeholder="e.g. Frontend Engineer — first round"
            aria-invalid={errors.title ? true : undefined}
            className="h-11"
            {...form.register("title")}
          />
        </Row>
        <FieldError errors={[errors.title]} />
      </Field>

      <Field className="gap-3">
        <Row label="Topic" hint="What the questions are about.">
          <Input
            id="assessment-topic"
            maxLength={120}
            placeholder="e.g. React, TypeScript, and web performance"
            aria-invalid={errors.topic ? true : undefined}
            className="h-11"
            {...form.register("topic")}
          />
        </Row>
        <FieldError errors={[errors.topic]} />
      </Field>

      <Field className="gap-3">
        <Row label="Question types" hint="Pick at least one.">
          <div className="grid gap-2 sm:grid-cols-3">
            {QUESTION_TYPES.map((type) => (
              <label key={type} className="cursor-pointer">
                <input
                  type="checkbox"
                  value={type}
                  className="peer sr-only"
                  {...form.register("types")}
                />
                <div className="rounded-md border p-3 text-sm transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  {TYPE_LABELS[type]}
                </div>
              </label>
            ))}
          </div>
        </Row>
        <FieldError errors={[errors.types]} />
      </Field>

      <div className="grid gap-10 sm:grid-cols-2">
        <Row label="Difficulty">
          <div className="grid gap-2">
            {DIFFICULTIES.map((d) => (
              <label key={d} className="cursor-pointer">
                <input
                  type="radio"
                  value={d}
                  className="peer sr-only"
                  {...form.register("difficulty")}
                />
                <div className="flex items-baseline justify-between rounded-md border px-3 py-2 text-sm transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  <span className="capitalize">{d.toLowerCase()}</span>
                  <span className="text-muted-foreground text-xs">
                    {DIFFICULTY_HINTS[d]}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </Row>

        <div className="space-y-10">
          <Row label="Questions">
            <div className="grid grid-cols-4 gap-2">
              {SCREEN_COUNTS.map((n) => (
                <label key={n} className="cursor-pointer">
                  <input
                    type="radio"
                    value={n}
                    className="peer sr-only"
                    {...form.register("questionCount")}
                  />
                  <div className="rounded-md border py-2 text-center font-mono text-sm tabular transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    {n}
                  </div>
                </label>
              ))}
            </div>
          </Row>

          <Row label="Time limit" hint="Screens are always timed.">
            <div className="flex flex-wrap gap-2">
              {SCREEN_TIMES.map((m) => (
                <label key={m} className="cursor-pointer">
                  <input
                    type="radio"
                    value={m}
                    className="peer sr-only"
                    {...form.register("timeLimitMinutes")}
                  />
                  <div className="rounded-md border px-3 py-2 text-xs transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    {m} min
                  </div>
                </label>
              ))}
            </div>
          </Row>
        </div>
      </div>

      {serverError ? (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" className="min-w-44">
          Generate & freeze
        </Button>
        <p className="text-muted-foreground text-xs">
          The set is written once and frozen — every candidate answers the same
          questions.
        </p>
      </div>
    </form>
  );
}

/** Label + optional hint header above a control or control group. */
function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <FieldLabel asChild>
          <DataLabel>{label}</DataLabel>
        </FieldLabel>
        {hint ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
