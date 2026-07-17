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
/**
 * "What does the following code print?" — with no code in the prompt.
 *
 * Observed in the wild: the model writes the stem and drops the snippet, and
 * the reader gets a question that cannot be answered. The prompt field is the
 * only thing they see, so if it promises code it has to contain code.
 */
const REFERS_TO_CODE =
  /\b(?:following|this|the below|below)\s+(?:javascript\s+|js\s+|python\s+|sql\s+|css\s+|html\s+|typescript\s+|ts\s+)?(?:code|snippet|function|program|script|component|query)\b/i;

function promisesCodeButHasNone(prompt: string): boolean {
  return REFERS_TO_CODE.test(prompt) && !prompt.includes("```");
}

/** A line that opens an MCQ option: "A)", "(B)", "C.", "D -", any case. */
const OPTION_LINE = /^\s*\(?([A-Da-d])[).:\]-]\s+\S/;

/**
 * The options belong in the choices field; the reader sees them rendered as
 * selectable answers under the prompt. The model sometimes lists them in the
 * prompt text too, and then the same four options show up twice — once as prose
 * and once as buttons.
 *
 * This removes a trailing block of option lines from an MCQ prompt, but only
 * when it is unmistakably that: a run to the end of the prompt where every
 * non-blank line is option-formatted, at least two distinct letters appear, and
 * it starts at A. A lone sentence that happens to open with "A)" isn't a block,
 * and a fenced code block in the tail breaks the all-option-lines test — so a
 * real stem, or a "what does this print" snippet, is never touched.
 */
export function stripInlineMcqOptions(prompt: string): string {
  const lines = prompt.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (!OPTION_LINE.test(lines[i])) continue;

    const tail = lines.slice(i).filter((l) => l.trim() !== "");
    if (tail.length < 2) continue;
    if (!tail.every((l) => OPTION_LINE.test(l))) continue;

    const letters = new Set(
      tail.map((l) =>
        (l.match(OPTION_LINE) as RegExpMatchArray)[1].toUpperCase(),
      ),
    );
    if (letters.size < 2 || !letters.has("A")) continue;

    const head = lines.slice(0, i).join("\n").trim();
    // Never strip the whole prompt away — a duplicated option is a smaller
    // failure than a blank question.
    return head || prompt;
  }

  return prompt;
}

export function normalizeQuestion(q: WireQuestion): NormalizedQuestion | null {
  const prompt = q.prompt.trim();

  // Dropping it costs one question; the generator tops the set back up. Showing
  // it costs the reader's trust in every other question on the page.
  if (promisesCodeButHasNone(prompt)) return null;

  const concepts = q.concepts
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 3);

  const base = {
    prompt,
    explanation: q.explanation.trim(),
    concepts,
  };

  switch (q.type) {
    case "MCQ": {
      const choices = q.choices
        .map((c) => ({ key: c.key.trim(), text: c.text.trim() }))
        .filter((c) => c.key && c.text);

      if (choices.length < 2) return null;

      // The real options live in `choices`; drop any copy the model inlined into
      // the prompt so it doesn't render twice.
      const cleanedPrompt = stripInlineMcqOptions(base.prompt);

      // Match case-insensitively: the model is consistent about keys but not
      // always about their case.
      const key = choices.find(
        (c) => c.key.toLowerCase() === q.answerKey.trim().toLowerCase(),
      )?.key;
      if (!key) return null;

      return {
        ...base,
        prompt: cleanedPrompt,
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
