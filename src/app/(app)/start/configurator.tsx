"use client";

import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataLabel } from "@/components/ui/prose";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { JD_MAX, JD_MIN } from "@/lib/jd";
import {
  DIFFICULTIES,
  type Difficulty,
  QUESTION_COUNTS,
  QUESTION_TYPES,
  type QuestionType,
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
  const [state, formAction, pending] = useActionState(
    createInterviewSession,
    null,
  );
  // Controlled so a preset can fill the field and light up as chosen. The field
  // stays free text: the presets are a shortcut, not the menu.
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState<number>(10);

  return (
    <form action={formAction} className="space-y-10">
      <Field label="Topic" hint="Anything you want to be tested on.">
        <Input
          name="topic"
          required
          maxLength={120}
          autoFocus
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. React hooks, photosynthesis, system design"
          className="h-12 text-base"
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
                      onClick={() => setTopic(t)}
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
      </Field>

      <TypesField />

      <div className="grid gap-10 sm:grid-cols-2">
        <Field label="Difficulty">
          <div className="grid gap-2">
            {DIFFICULTIES.map((d) => (
              <label key={d} className="cursor-pointer">
                <input
                  type="radio"
                  name="difficulty"
                  value={d}
                  defaultChecked={d === "MEDIUM"}
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
          {/* Not another rung on the ladder — a different contract, so it reads
              as a switch under the ladder rather than a sixth option. */}
          <AdaptiveToggle
            className="mt-3"
            hint="Starts at the difficulty you picked, then steps up or down as you answer. Ends with a calibrated level, not just a score."
          />
        </Field>

        <div className="space-y-10">
          <CountField count={count} setCount={setCount} />
          <TimeField />
        </div>
      </div>

      <FormFooter state={state} pending={pending} pendingLabel="Preparing…" />
    </form>
  );
}

function JdForm() {
  const [state, formAction, pending] = useActionState(createJdSession, null);
  const [jd, setJd] = useState("");
  const [count, setCount] = useState<number>(10);

  const len = jd.length;

  return (
    <form action={formAction} className="space-y-10">
      <Field
        label="Job description"
        hint="Paste the posting — responsibilities and requirements."
      >
        <Textarea
          name="jd"
          required
          minLength={JD_MIN}
          maxLength={JD_MAX}
          autoFocus
          rows={10}
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the full job description here — the more concrete the responsibilities and stack, the sharper the interview."
          className="min-h-56 text-sm leading-relaxed"
        />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="max-w-md text-muted-foreground text-xs">
            The description is read to write your questions. We store the
            extracted role and a short summary with this session — not the text
            you paste. Difficulty is set from the seniority in the posting.
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
      </Field>

      <TypesField />

      <div className="grid gap-10 sm:grid-cols-2">
        <CountField count={count} setCount={setCount} />
        <TimeField />
      </div>

      <AdaptiveToggle hint="Starts at the role's seniority, then steps up or down as you answer. Ends with a calibrated level, not just a score." />

      <FormFooter
        state={state}
        pending={pending}
        pendingLabel="Reading the job description…"
      />
    </form>
  );
}

function TypesField() {
  return (
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
  );
}

function CountField({
  count,
  setCount,
}: {
  count: number;
  setCount: (n: number) => void;
}) {
  return (
    <Field label="Questions">
      <div className="grid grid-cols-4 gap-2">
        {QUESTION_COUNTS.map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              name="questionCount"
              value={n}
              defaultChecked={n === 10}
              onChange={() => setCount(n)}
              className="peer sr-only"
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
  return (
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
  );
}

function AdaptiveToggle({
  hint,
  className,
}: {
  hint: string;
  className?: string;
}) {
  return (
    <label className={cn("block cursor-pointer", className)}>
      <input type="checkbox" name="adaptive" className="peer sr-only" />
      <div className="rounded-md border border-dashed px-3 py-2 transition-colors peer-checked:border-foreground peer-checked:border-solid peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
        <span className="text-sm">Adaptive</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      </div>
    </label>
  );
}

function FormFooter({
  state,
  pending,
  pendingLabel,
}: {
  state: { error: string } | null;
  pending: boolean;
  pendingLabel: string;
}) {
  return (
    <>
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
              {pendingLabel}
            </>
          ) : (
            "Start interview"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          No account needed. Sign up later to keep your history.
        </p>
      </div>
    </>
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
