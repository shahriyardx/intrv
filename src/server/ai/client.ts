import "server-only";
import { after } from "next/server";
import OpenAI from "openai";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { estimateCostUsd, MODELS, type ModelId } from "@/server/ai/models";

/** Thrown for conditions the caller can act on; message is safe to log, not to show. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly code:
      | "no_api_key"
      | "empty_response"
      | "invalid_output"
      | "insufficient_balance"
      | "rate_limited"
      | "unavailable"
      | "unknown",
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/**
 * Strict tool calling only exists on the /beta endpoint. Non-streaming calls go
 * through here so schema enforcement is server-side rather than hoped for.
 */
const beta = new OpenAI({
  apiKey: env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/beta",
});

const stable = new OpenAI({
  apiKey: env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export { beta as deepseekBeta, stable as deepseek };

const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 800;
/** Streaming reply attempts, including retries for an empty completion. */
const MAX_STREAM_ATTEMPTS = 3;

function classify(error: unknown): AiError {
  const status = (error as { status?: number })?.status;
  const message = error instanceof Error ? error.message : String(error);

  switch (status) {
    case 402:
      // The account is dry: every generation is failing right now. Never retry —
      // it wastes the user's time and cannot succeed.
      return new AiError(
        "DeepSeek balance exhausted",
        "insufficient_balance",
        false,
      );
    case 429:
      return new AiError("DeepSeek rate limited", "rate_limited", true);
    case 500:
    case 503:
      return new AiError("DeepSeek unavailable", "unavailable", true);
    case 400:
    case 401:
    case 422:
      return new AiError(
        `DeepSeek rejected the request: ${message}`,
        "unknown",
        false,
      );
    default:
      return new AiError(message, "unknown", true);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type CallOptions<T> = {
  model: ModelId;
  purpose: "generate" | "grade" | "extract";
  sessionId?: string | null;
  /** Static prefix first — it is what DeepSeek's automatic cache matches on. */
  system: string;
  /** Untrusted user content always travels as a user message, never in `system`. */
  user: string;
  toolName: string;
  toolDescription: string;
  parameters: Record<string, unknown>;
  schema: z.ZodType<T>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

/**
 * One structured DeepSeek call: strict tool schema, Zod-validated, retried, and
 * cost-tracked. Returns the parsed object or throws AiError.
 */
export async function callStructured<T>(opts: CallOptions<T>): Promise<T> {
  if (!env.DEEPSEEK_API_KEY) {
    throw new AiError("DEEPSEEK_API_KEY is not set", "no_api_key", false);
  }

  const startedAt = Date.now();
  let attempts = 0;
  let lastError: AiError | undefined;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    try {
      const completion = await beta.chat.completions.create(
        {
          model: opts.model,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: opts.toolName,
                description: opts.toolDescription,
                // Server-side schema enforcement. DeepSeek has no
                // response_format:json_schema — this is the only real gate.
                strict: true,
                parameters: opts.parameters,
              },
            },
          ],
          // Forcing the tool is what makes the output schema a guarantee rather
          // than a hope.
          tool_choice: {
            type: "function",
            function: { name: opts.toolName },
          },
          // Thinking is OFF and not configurable here, for a hard API reason:
          // verified 2026-07-16, DeepSeek rejects thinking + a forced
          // tool_choice with `400 Thinking mode does not support this
          // tool_choice`. With tool_choice:"auto" thinking works but the model
          // may answer in prose and never call the tool, which we would see as
          // an empty response. Schema reliability beats a reasoning trace here.
          // (Thinking also silently ignores temperature, so it buys less than
          // it looks like it does.)
          // @ts-expect-error -- DeepSeek-specific parameter, absent from OpenAI's types
          thinking: { type: "disabled" },
        },
        {
          signal: opts.signal,
          timeout: opts.timeoutMs ?? 120_000,
        },
      );

      const call = completion.choices[0]?.message?.tool_calls?.[0];
      const raw =
        call && "function" in call ? call.function.arguments : undefined;

      // DeepSeek's documented, unfixed bug: a 200 with empty content. An HTTP
      // level retry never sees this, so it has to be caught here.
      if (!raw) {
        throw new AiError(
          "DeepSeek returned an empty tool call",
          "empty_response",
          true,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new AiError(
          "DeepSeek returned unparseable JSON",
          "invalid_output",
          true,
        );
      }

      const result = opts.schema.safeParse(parsed);
      if (!result.success) {
        throw new AiError(
          `DeepSeek output failed validation: ${result.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
          "invalid_output",
          true,
        );
      }

      recordCall({
        sessionId: opts.sessionId ?? null,
        model: opts.model,
        purpose: opts.purpose,
        usage: completion.usage,
        latencyMs: Date.now() - startedAt,
        ok: true,
        attempts,
      });

      return result.data;
    } catch (error) {
      const aiError = error instanceof AiError ? error : classify(error);
      lastError = aiError;

      if (!aiError.retryable || attempts >= MAX_ATTEMPTS) break;

      // Exponential backoff with jitter — a thundering retry herd during a
      // DeepSeek blip makes the blip worse.
      const backoff = BASE_BACKOFF_MS * 2 ** (attempts - 1);
      await sleep(backoff + Math.random() * 250);
    }
  }

  recordCall({
    sessionId: opts.sessionId ?? null,
    model: opts.model,
    purpose: opts.purpose,
    usage: undefined,
    latencyMs: Date.now() - startedAt,
    ok: false,
    attempts,
    errorCode: lastError?.code,
  });

  throw lastError ?? new AiError("DeepSeek call failed", "unknown", false);
}

type ChatStreamOptions = {
  sessionId?: string | null;
  /** Static prefix — the teacher persona. Never interpolate variable content. */
  system: string;
  /** Untrusted student text and the question context ride here, never in system. */
  user: string;
  signal?: AbortSignal;
};

/**
 * A plain streamed chat completion, yielding content deltas as they arrive.
 *
 * Unlike callStructured this is not a forced tool call, so it runs on the stable
 * (non-/beta) endpoint — /beta only matters for strict tool schemas. There is no
 * mid-stream retry: once bytes are flowing to the user a restart would double
 * text. A pre-stream 429/5xx retries once, since nothing has been emitted yet.
 * Cost is recorded from the final usage frame (DeepSeek sends it last when
 * include_usage is set); if it never arrives we log zeros rather than block.
 */
export async function* callChatStream(
  opts: ChatStreamOptions,
): AsyncGenerator<string> {
  if (!env.DEEPSEEK_API_KEY) {
    throw new AiError("DEEPSEEK_API_KEY is not set", "no_api_key", false);
  }

  const startedAt = Date.now();
  let usage: UsageLike;

  // flash is a reasoning model, and it has a documented, unfixed habit of
  // spending a whole completion on reasoning_content and emitting no answer at
  // all — the stream finishes ok, usage shows hundreds of tokens, and
  // delta.content never arrives. Raising max_tokens does not help: this is not
  // truncation, the model just never wrote the answer half. The cure DeepSeek
  // recommends is to retry, so the whole call is wrapped in a retry loop that
  // fires whenever an attempt yields zero content. Retrying is safe precisely
  // because "empty" means nothing was streamed to the client yet.
  for (let attempt = 1; attempt <= MAX_STREAM_ATTEMPTS; attempt++) {
    let stream: Awaited<ReturnType<typeof stable.chat.completions.create>>;
    try {
      stream = await stable.chat.completions.create(
        {
          model: MODELS.flash,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          temperature: 0.6,
          // Covers the reasoning tokens (dropped) plus the answer; a full tutor
          // reply measured ~600 reasoning + ~900 answer.
          max_tokens: 2500,
          stream: true,
          // Ask DeepSeek to append a usage frame on the final chunk.
          stream_options: { include_usage: true },
        },
        { signal: opts.signal },
      );
    } catch (error) {
      const aiError = error instanceof AiError ? error : classify(error);
      // Nothing emitted yet, so a create failure is always safe to retry.
      if (aiError.retryable && attempt < MAX_STREAM_ATTEMPTS) {
        await sleep(BASE_BACKOFF_MS + Math.random() * 250);
        continue;
      }
      recordCall({
        sessionId: opts.sessionId ?? null,
        model: MODELS.flash,
        purpose: "discuss",
        usage: undefined,
        latencyMs: Date.now() - startedAt,
        ok: false,
        attempts: attempt,
        errorCode: aiError.code,
      });
      throw aiError;
    }

    let yielded = false;
    try {
      for await (const chunk of stream as AsyncIterable<{
        choices?: { delta?: { content?: string | null } }[];
        usage?: UsageLike;
      }>) {
        if (chunk.usage) usage = chunk.usage;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          yielded = true;
          yield delta;
        }
      }
    } catch (error) {
      // A mid-stream error can only be retried while nothing has been yielded —
      // once the client holds part of a reply, restarting would duplicate it.
      const aiError = error instanceof AiError ? error : classify(error);
      if (!yielded && aiError.retryable && attempt < MAX_STREAM_ATTEMPTS) {
        await sleep(BASE_BACKOFF_MS + Math.random() * 250);
        continue;
      }
      recordCall({
        sessionId: opts.sessionId ?? null,
        model: MODELS.flash,
        purpose: "discuss",
        usage,
        latencyMs: Date.now() - startedAt,
        ok: false,
        attempts: attempt,
        errorCode: aiError.code,
      });
      throw aiError;
    }

    if (yielded) {
      recordCall({
        sessionId: opts.sessionId ?? null,
        model: MODELS.flash,
        purpose: "discuss",
        usage,
        latencyMs: Date.now() - startedAt,
        ok: true,
        attempts: attempt,
      });
      return;
    }

    // Empty completion — retry if there are attempts left, otherwise give up and
    // let the caller surface "the tutor didn't answer".
    if (attempt < MAX_STREAM_ATTEMPTS) {
      await sleep(BASE_BACKOFF_MS + Math.random() * 250);
      continue;
    }
    recordCall({
      sessionId: opts.sessionId ?? null,
      model: MODELS.flash,
      purpose: "discuss",
      usage,
      latencyMs: Date.now() - startedAt,
      ok: false,
      attempts: attempt,
      errorCode: "empty_content",
    });
  }
}

type UsageLike =
  | {
      prompt_cache_hit_tokens?: number;
      prompt_cache_miss_tokens?: number;
      completion_tokens?: number;
    }
  | null
  | undefined;

/**
 * Cost tracking must never delay or fail a user-facing response, so it runs
 * after the response is sent and swallows its own errors.
 */
export function recordCall(args: {
  sessionId: string | null;
  model: string;
  purpose: string;
  usage: UsageLike;
  latencyMs: number;
  ok: boolean;
  attempts: number;
  errorCode?: string;
}) {
  const usage = args.usage as UsageLike;
  const cacheHitTokens = usage?.prompt_cache_hit_tokens ?? 0;
  const cacheMissTokens = usage?.prompt_cache_miss_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;

  const write = async () => {
    try {
      await prisma.aiCall.create({
        data: {
          sessionId: args.sessionId,
          model: args.model,
          purpose: args.purpose,
          promptCacheHitTokens: cacheHitTokens,
          promptCacheMissTokens: cacheMissTokens,
          outputTokens,
          costUsd: estimateCostUsd(args.model, {
            cacheHitTokens,
            cacheMissTokens,
            outputTokens,
          }).toFixed(6),
          latencyMs: args.latencyMs,
          ok: args.ok,
          errorCode: args.errorCode ?? null,
          attempts: args.attempts,
        },
      });
    } catch (error) {
      console.error("failed to record AiCall", error);
    }
  };

  try {
    after(write);
  } catch {
    // after() is unavailable outside a request scope (scripts, tests).
    void write();
  }
}
