import { z } from "zod";

/**
 * Shared client+server contracts. No `server-only` here on purpose: the
 * configurator form and the server action must validate against the same rules.
 */

/**
 * Ordered easiest to hardest. The order is load-bearing: the UI renders the
 * ladder in this order, and the leaderboard weights points by it.
 */
export const DIFFICULTIES = [
  "BEGINNER",
  "EASY",
  "MEDIUM",
  "HARD",
  "EXPERT",
] as const;
export const QUESTION_TYPES = ["MCQ", "TRUE_FALSE", "SHORT_ANSWER"] as const;

export const difficultySchema = z.enum(DIFFICULTIES);
export const questionTypeSchema = z.enum(QUESTION_TYPES);

export type Difficulty = z.infer<typeof difficultySchema>;
export type QuestionType = z.infer<typeof questionTypeSchema>;

/**
 * Generation batches three questions per model call, so a 50-question set is
 * ~17 calls. They stream in and you answer from the first one, but the tail
 * takes a couple of minutes — the UI says so rather than pretending otherwise.
 */
export const QUESTION_COUNTS = [5, 10, 15, 20, 30, 40, 50] as const;

/**
 * The topic is untrusted text that ends up near a model prompt. Length and
 * charset are bounded here, and it only ever travels as a user message — never
 * interpolated into a system prompt.
 */
export const topicSchema = z
  .string()
  .trim()
  .min(2, "Give the topic at least 2 characters.")
  .max(120, "Keep the topic under 120 characters.")
  // Control characters are exactly what we want to reject: they can smuggle
  // line breaks into the prompt and let a "topic" impersonate a new message.
  .refine(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
    (v) => !/[\u0000-\u001f\u007f]/.test(v),
    "Topic contains control characters.",
  );

export const createSessionSchema = z.object({
  topic: topicSchema,
  difficulty: difficultySchema,
  questionCount: z
    .number()
    .int()
    .refine((n) => (QUESTION_COUNTS as readonly number[]).includes(n), {
      message: "Pick a supported question count.",
    }),
  types: z
    .array(questionTypeSchema)
    .min(1, "Choose at least one question type.")
    .max(3),
  /** Null means untimed. */
  timeLimitMinutes: z.number().int().min(1).max(180).nullable(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/** What the user submits per question. Discriminated on the question's type. */
export const answerResponseSchema = z.union([
  z.object({ kind: z.literal("MCQ"), key: z.string().min(1).max(8) }),
  z.object({ kind: z.literal("TRUE_FALSE"), value: z.boolean() }),
  z.object({ kind: z.literal("SHORT_ANSWER"), text: z.string().max(4000) }),
]);

export type AnswerResponse = z.infer<typeof answerResponseSchema>;

/** Persisted answer keys. Never serialized to the client before grading. */
export const answerKeySchema = z.union([
  z.object({ kind: z.literal("MCQ"), key: z.string() }),
  z.object({ kind: z.literal("TRUE_FALSE"), value: z.boolean() }),
  z.object({
    kind: z.literal("SHORT_ANSWER"),
    expected: z.string(),
    keyPoints: z.array(z.string()),
  }),
]);

export type AnswerKey = z.infer<typeof answerKeySchema>;

export const choiceSchema = z.object({
  key: z.string().min(1).max(8),
  text: z.string().min(1),
});

export type Choice = z.infer<typeof choiceSchema>;
