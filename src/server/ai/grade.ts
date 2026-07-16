import "server-only";
import { z } from "zod";
import { callStructured } from "@/server/ai/client";
import { MODELS } from "@/server/ai/models";
import { buildGradeUser, GRADE_SYSTEM } from "@/server/ai/prompts";

const emitGradesParameters = {
  type: "object",
  additionalProperties: false,
  required: ["grades"],
  properties: {
    grades: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "score", "feedback"],
        properties: {
          id: {
            type: "string",
            description: "The question id you were given.",
          },
          score: {
            type: "integer",
            description: "0-100. Partial credit is expected and encouraged.",
          },
          feedback: {
            type: "string",
            description:
              "One or two sentences addressed to the student as 'you'.",
          },
        },
      },
    },
  },
} as const;

const emitGradesSchema = z.object({
  grades: z.array(
    z.object({
      id: z.string(),
      // The model occasionally exceeds the stated range; clamp rather than
      // reject, since rejecting would fail the whole batch.
      score: z
        .number()
        .transform((n) => Math.max(0, Math.min(100, Math.round(n)))),
      feedback: z.string().default(""),
    }),
  ),
});

export type GradeItem = {
  id: string;
  prompt: string;
  expected: string;
  keyPoints: string[];
  answer: string;
};

export type GradeResult = { id: string; score: number; feedback: string };

/**
 * Grades short answers in one batched call: cheaper than one call each, and it
 * lets the model calibrate across the set rather than drifting between them.
 */
export async function gradeShortAnswers(
  items: GradeItem[],
  opts: { sessionId?: string; signal?: AbortSignal } = {},
): Promise<Map<string, GradeResult>> {
  if (items.length === 0) return new Map();

  const result = await callStructured({
    model: MODELS.flash,
    purpose: "grade",
    sessionId: opts.sessionId,
    system: GRADE_SYSTEM,
    user: buildGradeUser(items),
    toolName: "emit_grades",
    toolDescription: "Emit one grade per question id.",
    parameters: emitGradesParameters as unknown as Record<string, unknown>,
    schema: emitGradesSchema,
    timeoutMs: 300_000,
    signal: opts.signal,
  });

  const byId = new Map<string, GradeResult>();
  const requested = new Set(items.map((i) => i.id));

  for (const grade of result.grades) {
    // Ignore ids we never asked about rather than trusting the model's bookkeeping.
    if (requested.has(grade.id)) byId.set(grade.id, grade);
  }

  return byId;
}
