import "server-only";
import { z } from "zod";
import type { AnswerKey, Choice } from "@/lib/schemas";

/**
 * DeepSeek strict mode requires every property to appear in `required` and
 * `additionalProperties: false`, and it does not support `minItems`. Hence the
 * flat wire shape: one `answerKey` string covering all three question types,
 * with the real invariants enforced by Zod and the normalizer below.
 *
 * Do not trust `required` to mean "present" — see the note on wireQuestionSchema.
 */
export const emitQuestionsParameters = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      description:
        "The generated questions, in the order they should be asked.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "prompt",
          "choices",
          "answerKey",
          "keyPoints",
          "explanation",
          "concepts",
        ],
        properties: {
          type: { type: "string", enum: ["MCQ", "TRUE_FALSE", "SHORT_ANSWER"] },
          prompt: { type: "string", description: "The question itself." },
          choices: {
            type: "array",
            description:
              "MCQ only: 4 options with keys A-D. Empty array for other types.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "text"],
              properties: {
                key: { type: "string" },
                text: { type: "string" },
              },
            },
          },
          answerKey: {
            type: "string",
            description:
              'MCQ: the correct choice key (e.g. "A"). TRUE_FALSE: "TRUE" or "FALSE". SHORT_ANSWER: a concise model answer.',
          },
          keyPoints: {
            type: "array",
            description:
              "SHORT_ANSWER only: the points a full-credit answer must make. Empty array for other types.",
            items: { type: "string" },
          },
          explanation: {
            type: "string",
            description: "Why the answer is correct. Shown after grading.",
          },
          concepts: {
            type: "array",
            description: "1-3 concept tags, lowercase, for weakness tracking.",
            items: { type: "string" },
          },
        },
      },
    },
  },
} as const;

/**
 * Every array here is `.default([])` for a reason found the hard way: DeepSeek's
 * strict mode does NOT guarantee that `required` properties are present. It
 * omits ones it judges inapplicable — a TRUE_FALSE question arrives with no
 * `choices` key at all, and a non-SHORT_ANSWER with no `keyPoints` — despite
 * both being listed in `required`. Strict mode constrains the *types* of the
 * fields it emits, not their presence.
 *
 * So absent means empty, which is exactly what the normalizer expects. Treating
 * it as a validation error instead would fail every mixed-type batch.
 */
const wireQuestionSchema = z.object({
  type: z.enum(["MCQ", "TRUE_FALSE", "SHORT_ANSWER"]),
  prompt: z.string().min(1).max(2000),
  choices: z.array(z.object({ key: z.string(), text: z.string() })).default([]),
  answerKey: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
  explanation: z.string().default(""),
  concepts: z.array(z.string()).default([]),
});

export const emitQuestionsSchema = z.object({
  questions: z.array(wireQuestionSchema).min(1),
});

export type WireQuestion = z.infer<typeof wireQuestionSchema>;

export type NormalizedQuestion = {
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
  prompt: string;
  choices: Choice[] | null;
  answerKey: AnswerKey;
  explanation: string;
  concepts: string[];
};

/**
 * Turns a loose wire question into a domain question, or null if it is
 * self-inconsistent (e.g. an MCQ whose answer key names no choice). Returning
 * null rather than throwing lets one bad question be dropped without losing the
 * whole batch — the generator tops up to the requested count.
 */
export function normalizeQuestion(q: WireQuestion): NormalizedQuestion | null {
  const concepts = q.concepts
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 3);

  const base = {
    prompt: q.prompt.trim(),
    explanation: q.explanation.trim(),
    concepts,
  };

  switch (q.type) {
    case "MCQ": {
      const choices = q.choices
        .map((c) => ({ key: c.key.trim(), text: c.text.trim() }))
        .filter((c) => c.key && c.text);

      if (choices.length < 2) return null;

      // Match case-insensitively: the model is consistent about keys but not
      // always about their case.
      const key = choices.find(
        (c) => c.key.toLowerCase() === q.answerKey.trim().toLowerCase(),
      )?.key;
      if (!key) return null;

      return {
        ...base,
        type: "MCQ",
        choices,
        answerKey: { kind: "MCQ", key },
      };
    }

    case "TRUE_FALSE": {
      const raw = q.answerKey.trim().toLowerCase();
      if (raw !== "true" && raw !== "false") return null;

      return {
        ...base,
        type: "TRUE_FALSE",
        choices: null,
        answerKey: { kind: "TRUE_FALSE", value: raw === "true" },
      };
    }

    case "SHORT_ANSWER": {
      const expected = q.answerKey.trim();
      if (!expected) return null;

      return {
        ...base,
        type: "SHORT_ANSWER",
        choices: null,
        answerKey: {
          kind: "SHORT_ANSWER",
          expected,
          keyPoints: q.keyPoints.map((k) => k.trim()).filter(Boolean),
        },
      };
    }
  }
}
