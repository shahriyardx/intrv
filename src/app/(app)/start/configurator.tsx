"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useRef, useState, useTransition } from "react";
import {
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Field as UiField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataLabel } from "@/components/ui/prose";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { JD_MAX, jdTextSchema } from "@/lib/jd";
import {
  DIFFICULTIES,
  type Difficulty,
  QUESTION_COUNTS,
  QUESTION_TYPES,
  type QuestionType,
  questionTypeSchema,
  topicSchema,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { createInterviewSession } from "@/server/actions/interview";
import { createJdSession } from "@/server/actions/jd";

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

const TIME_OPTIONS = [
  { label: "Untimed", value: "" },
  { label: "5 min", value: "5" },
  { label: "10 min", value: "10" },
  { label: "20 min", value: "20" },
  { label: "45 min", value: "45" },
];

/**
 * Presets, not a taxonomy: the topic is free text and always will be. These
 * exist because a blank field is the hardest thing to answer, and because the
 * model writes sharper questions for a topic it has seen a thousand times.
 */
const PRESETS: { group: string; topics: string[] }[] = [
  {
    group: "Frontend",
    topics: [
      "HTML",
      "CSS",
      "JavaScript",
      "TypeScript",
      "React",
      "Next.js",
      "Tailwind CSS",
      "Web accessibility",
    ],
  },
  {
    group: "Backend",
    topics: [
      "Node.js",
      "REST API design",
      "SQL",
      "PostgreSQL",
      "MongoDB",
      "Redis",
      "Authentication",
      "System design",
    ],
  },
  {
    group: "Foundations",
    topics: [
      "Data structures",
      "Algorithms",
      "Git",
      "Docker",
      "Testing",
      "Python",
      "Networking & HTTP",
      "Behavioural interview",
    ],
  },
];

// The controls shared by both tabs. Radios/checkboxes carry strings; the server
// actions do the Number()/=== "on" conversions and re-validate everything —
// these client schemas are UX only.
const sharedShape = {
  types: z
    .array(questionTypeSchema)
    .min(1, "Choose at least one question type."),
  questionCount: z.string(),
  timeLimitMinutes: z.string(),
  adaptive: z.boolean(),
};

const topicFormSchema = z.object({
  topic: topicSchema,
  difficulty: z.enum(DIFFICULTIES),
  ...sharedShape,
});

const jdFormSchema = z.object({
  jd: jdTextSchema,
  ...sharedShape,
});

const SHARED_DEFAULTS = {
  types: [...QUESTION_TYPES],
  questionCount: "10",
  timeLimitMinutes: "",
  adaptive: false,
};

/**
 * Two ways in: pick a topic, or paste a job description and let us read the role
 * out of it. The forms share every control except how they name the subject —
 * topic vs. extracted role/seniority.
 */
export function Configurator() {
  return (
    <Tabs defaultValue="topic">
      <TabsList className="mb-8 h-9">
        <TabsTrigger value="topic" className="px-4 text-sm">
          By topic
        </TabsTrigger>
        <TabsTrigger value="jd" className="px-4 text-sm">
          From a job description
        </TabsTrigger>
      </TabsList>

      <TabsContent value="topic">
        <TopicForm />
      </TabsContent>
      <TabsContent value="jd">
        <JdForm />
      </TabsContent>
    </Tabs>
  );
}

function TopicForm() {
  // reactCompiler breaks RHF v7's formState/watch Proxy subscription — opt out.
  "use no memo";
  const form = useForm<z.input<typeof topicFormSchema>>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: { topic: "", difficulty: "MEDIUM", ...SHARED_DEFAULTS },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // A stable ref, not the submit event's currentTarget: react-hook-form awaits
  // async validation before calling this, by which point React has nulled the
  // event's currentTarget. The ref reads live values (registered inputs,
  // checkboxes as arrays, adaptive as "on") exactly like a native submit.
  const formRef = useRef<HTMLFormElement>(null);

  const topic = form.watch("topic");

  const onSubmit = form.handleSubmit(() => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    setServerError(null);
    startTransition(async () => {
      const result = await createInterviewSession(null, data);
      if (result && !result.ok) setServerError(result.error);
    });
  });

  return (
    <FormProvider {...form}>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-10">
        <Field label="Topic" hint="Anything you want to be tested on.">
          <Input
            maxLength={120}
            autoFocus
            placeholder="e.g. React hooks, photosynthesis, system design"
            aria-invalid={form.formState.errors.topic ? true : undefined}
            className="h-12 text-base"
            {...form.register("topic")}
          />
          {/* Groups are labelled on their own line: inline labels collided with
              the first chip, and the pill shape fought every other control on
              this form. Same sharp rectangles as the rest of it. */}
          <div className="mt-5 space-y-4">
            {PRESETS.map((preset) => (
              <div key={preset.group}>
                <span className="block font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
                  {preset.group}
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preset.topics.map((t) => {
                    const selected = topic === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          form.setValue("topic", t, {
                            shouldValidate: true,
                          })
                        }
                        className={cn(
                          "rounded-sm border px-2.5 py-1.5 text-xs transition-colors",
                          selected
                            ? "border-foreground bg-secondary text-foreground"
                            : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <FieldError errors={[form.formState.errors.topic]} />
        </Field>

        <TypesField />

        <div className="grid gap-10 sm:grid-cols-2">
          <Field label="Difficulty">
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
            {/* Not another rung on the ladder — a different contract, so it reads
                as a switch under the ladder rather than a sixth option. */}
            <AdaptiveToggle
              className="mt-3"
              hint="Starts at the difficulty you picked, then steps up or down as you answer. Ends with a calibrated level, not just a score."
            />
          </Field>

          <div className="space-y-10">
            <CountField />
            <TimeField />
          </div>
        </div>

        <FormFooter
          serverError={serverError}
          pending={pending}
          pendingLabel="Preparing…"
        />
      </form>
    </FormProvider>
  );
}

function JdForm() {
  // reactCompiler breaks RHF v7's formState/watch Proxy subscription — opt out.
  "use no memo";
  const form = useForm<z.input<typeof jdFormSchema>>({
    resolver: zodResolver(jdFormSchema),
    defaultValues: { jd: "", ...SHARED_DEFAULTS },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const len = (form.watch("jd") ?? "").length;

  const onSubmit = form.handleSubmit(() => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    setServerError(null);
    startTransition(async () => {
      const result = await createJdSession(null, data);
      if (result && !result.ok) setServerError(result.error);
    });
  });

  return (
    <FormProvider {...form}>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-10">
        <Field
          label="Job description"
          hint="Paste the posting — responsibilities and requirements."
        >
          <Textarea
            autoFocus
            rows={10}
            maxLength={JD_MAX}
            placeholder="Paste the full job description here — the more concrete the responsibilities and stack, the sharper the interview."
            aria-invalid={form.formState.errors.jd ? true : undefined}
            className="min-h-56 text-sm leading-relaxed"
            {...form.register("jd")}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="max-w-md text-muted-foreground text-xs">
              The description is read to write your questions. We store the
              extracted role and a short summary with this session — not the
              text you paste. Difficulty is set from the seniority in the
              posting.
            </span>
            <span
              className={cn(
                "font-mono text-[0.625rem] text-muted-foreground tabular",
                len > JD_MAX && "text-destructive",
              )}
            >
              {len}/{JD_MAX}
            </span>
          </div>
          <FieldError errors={[form.formState.errors.jd]} />
        </Field>

        <TypesField />

        <div className="grid gap-10 sm:grid-cols-2">
          <CountField />
          <TimeField />
        </div>

        <AdaptiveToggle hint="Starts at the role's seniority, then steps up or down as you answer. Ends with a calibrated level, not just a score." />

        <FormFooter
          serverError={serverError}
          pending={pending}
          pendingLabel="Reading the job description…"
        />
      </form>
    </FormProvider>
  );
}

function TypesField() {
  // reactCompiler breaks RHF v7's formState Proxy subscription — opt out.
  "use no memo";
  const { register, formState } = useFormContext();
  return (
    <Field label="Question types" hint="Pick at least one.">
      <div className="grid gap-2 sm:grid-cols-3">
        {QUESTION_TYPES.map((type) => (
          <label key={type} className="cursor-pointer">
            <input
              type="checkbox"
              value={type}
              className="peer sr-only"
              {...register("types")}
            />
            <div className="rounded-md border p-3 text-sm transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              {TYPE_LABELS[type]}
            </div>
          </label>
        ))}
      </div>
      <FieldError errors={[formState.errors.types]} />
    </Field>
  );
}

function CountField() {
  // reactCompiler breaks RHF v7's watch subscription — opt out.
  "use no memo";
  const { register } = useFormContext();
  const count = Number(useWatch({ name: "questionCount" }) ?? "10");

  return (
    <Field label="Questions">
      <div className="grid grid-cols-4 gap-2">
        {QUESTION_COUNTS.map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              value={n}
              className="peer sr-only"
              {...register("questionCount")}
            />
            <div className="rounded-md border py-2 text-center font-mono text-sm tabular transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              {n}
            </div>
          </label>
        ))}
      </div>
      {count >= 30 ? (
        // Three questions per model call, so a long set keeps arriving for a
        // couple of minutes. Better to say so than to look stuck.
        <p className="mt-2 text-muted-foreground text-xs">
          {count} questions take a few minutes to finish writing. You can start
          on the first ones straight away.
        </p>
      ) : null}
    </Field>
  );
}

function TimeField() {
  const { register } = useFormContext();
  return (
    <Field label="Time limit">
      <div className="flex flex-wrap gap-2">
        {TIME_OPTIONS.map((opt) => (
          <label key={opt.label} className="cursor-pointer">
            <input
              type="radio"
              value={opt.value}
              className="peer sr-only"
              {...register("timeLimitMinutes")}
            />
            <div className="rounded-md border px-3 py-2 text-xs transition-colors peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              {opt.label}
            </div>
          </label>
        ))}
      </div>
    </Field>
  );
}

function AdaptiveToggle({
  hint,
  className,
}: {
  hint: string;
  className?: string;
}) {
  const { register } = useFormContext();
  return (
    <label className={cn("block cursor-pointer", className)}>
      <input
        type="checkbox"
        className="peer sr-only"
        {...register("adaptive")}
      />
      <div className="rounded-md border border-dashed px-3 py-2 transition-colors peer-checked:border-foreground peer-checked:border-solid peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
        <span className="text-sm">Adaptive</span>
        <span className="mt-0.5 block text-muted-foreground text-xs">
          {hint}
        </span>
      </div>
    </label>
  );
}

function FormFooter({
  serverError,
  pending,
  pendingLabel,
}: {
  serverError: string | null;
  pending: boolean;
  pendingLabel: string;
}) {
  return (
    <>
      {serverError ? (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending} className="min-w-44">
          {pending ? (
            <>
              <SpinnerGapIcon className="size-4 animate-spin" />
              {pendingLabel}
            </>
          ) : (
            "Start interview"
          )}
        </Button>
        <p className="text-muted-foreground text-xs">
          No account needed. Sign up later to keep your history.
        </p>
      </div>
    </>
  );
}

/** Label + optional hint header above a control or control group. */
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
    <UiField className={cn("gap-3", className)}>
      <div className="flex items-baseline justify-between">
        <Label asChild>
          <DataLabel>{label}</DataLabel>
        </Label>
        {hint ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </div>
      {children}
    </UiField>
  );
}
