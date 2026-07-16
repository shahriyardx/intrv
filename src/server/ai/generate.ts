import "server-only";
import type { Difficulty, QuestionType } from "@/lib/schemas";
import { callStructured } from "@/server/ai/client";
import { MODELS } from "@/server/ai/models";
import { buildGenerateUser, GENERATE_SYSTEM } from "@/server/ai/prompts";
import {
  emitQuestionsParameters,
  emitQuestionsSchema,
  type NormalizedQuestion,
  normalizeQuestion,
} from "@/server/ai/schemas";

export type GenerateInput = {
  topic: string;
  difficulty: Difficulty;
  types: QuestionType[];
  count: number;
  /**
   * Extra focus text: the extracted JD profile (JOB_DESCRIPTION mode) or the
   * due-concept list (REVIEW mode). Rides in the user message — never the
   * system prompt — so the cacheable prefix stays byte-identical.
   */
  brief?: string;
  sessionId?: string;
  signal?: AbortSignal;
};

/**
 * Questions per DeepSeek call.
 *
 * Strict tool calling gives us a schema guarantee, but only once the whole tool
 * call has landed — there is no valid partial JSON to stream. A single call for
 * 10 questions measured ~28s, which is a long spinner. Batching trades a little
 * total cost for a first batch in roughly a third of that, and the static
 * system prefix cache-hits on every batch after the first (~50x cheaper input),
 * so the real added cost is small.
 */
const BATCH_SIZE = 3;

/**
 * A batch can come back short or with unusable questions, so passes must exceed
 * the ideal count/BATCH_SIZE — but the cap has to scale with the request. A
 * fixed cap of 6 silently topped out a 50-question set at 18.
 */
function maxPasses(count: number): number {
  return Math.ceil(count / BATCH_SIZE) + 4;
}

/**
 * How many previously-asked questions to show the model.
 *
 * The avoid list exists to stop repeats, but it rides in the *variable* half of
 * the prompt, so every entry is a cache miss paid on every later call. At 50
 * questions an uncapped list would send the whole set back on each pass. The
 * most recent ones are what the model is actually liable to restate.
 */
const AVOID_WINDOW = 12;

/**
 * Yields questions in batches as DeepSeek produces them.
 *
 * Callers get progressive delivery; the count invariant (strict schemas cannot
 * express minItems) is enforced here by looping until satisfied or out of
 * passes. Duplicate prompts are dropped — the model occasionally restates a
 * question despite the avoid list.
 */
export async function* generateQuestionsStream(
  input: GenerateInput,
): AsyncGenerator<NormalizedQuestion> {
  const seen = new Set<string>();
  const asked: string[] = [];
  let produced = 0;
  let passes = 0;

  const passLimit = maxPasses(input.count);

  while (produced < input.count && passes < passLimit) {
    passes++;
    const want = Math.min(BATCH_SIZE, input.count - produced);

    const result = await callStructured({
      model: MODELS.flash,
      purpose: "generate",
      sessionId: input.sessionId,
      system: GENERATE_SYSTEM,
      user: buildGenerateUser({
        topic: input.topic,
        difficulty: input.difficulty,
        types: input.types,
        count: want,
        brief: input.brief,
        avoid: asked.length ? asked.slice(-AVOID_WINDOW) : undefined,
      }),
      toolName: "emit_questions",
      toolDescription: "Emit the generated questions.",
      parameters: emitQuestionsParameters as unknown as Record<string, unknown>,
      schema: emitQuestionsSchema,
      timeoutMs: 120_000,
      signal: input.signal,
    });

    let yieldedThisPass = 0;

    for (const wire of result.questions) {
      if (produced >= input.count) break;

      const question = normalizeQuestion(wire);
      if (!question) continue;

      const fingerprint = question.prompt
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      if (seen.has(fingerprint)) continue;

      seen.add(fingerprint);
      asked.push(question.prompt);
      produced++;
      yieldedThisPass++;
      yield question;
    }

    // A pass that adds nothing new means the topic is exhausted; looping would
    // just burn tokens and the user's patience.
    if (yieldedThisPass === 0) break;
  }
}

/** Collects the stream. For callers that cannot use progressive delivery. */
export async function generateQuestions(
  input: GenerateInput,
): Promise<NormalizedQuestion[]> {
  const out: NormalizedQuestion[] = [];
  for await (const question of generateQuestionsStream(input)) {
    out.push(question);
  }
  return out;
}
