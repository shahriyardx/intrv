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
import { planTypeMix } from "@/server/ai/type-mix";

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
  /**
   * Prompts already asked in earlier batches of the same session. Batched
   * generation calls this function once per rung, so without a seed each call
   * would forget what the previous ones produced and repeat it. Seeds both the
   * dedup set and the avoid-list; the same AVOID_WINDOW cap still applies.
   */
  avoidSeed?: string[];
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

  // Seed from earlier batches so a later batch doesn't restate
  // questions already asked. Fingerprints match the dedup key computed below.
  for (const prompt of input.avoidSeed ?? []) {
    const fingerprint = prompt.toLowerCase().replace(/\s+/g, " ").trim();
    if (fingerprint) {
      seen.add(fingerprint);
      asked.push(prompt);
    }
  }

  let produced = 0;
  let passes = 0;

  const passLimit = maxPasses(input.count);

  // The type of every slot, decided here rather than asked of the model — see
  // ai/type-mix.ts. Kept as a ledger of what is still owed rather than an
  // index, because questions get dropped for being duplicates and a positional
  // plan would drift out of step with what actually shipped.
  const owed = planTypeMix(input.types, input.count);

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
        plan: owed.slice(0, want),
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

      // The one type worth refusing. A true/false question is a coin flip, so
      // a set that quietly fills up with them measures luck; MCQ and short
      // answer are both wanted, so over-delivery of those is accepted rather
      // than risking a stall over an exact ratio.
      const stillOwed = owed.indexOf(question.type);
      if (question.type === "TRUE_FALSE" && stillOwed === -1) continue;

      const fingerprint = question.prompt
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      if (seen.has(fingerprint)) continue;

      seen.add(fingerprint);
      asked.push(question.prompt);
      if (stillOwed !== -1) owed.splice(stillOwed, 1);
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
