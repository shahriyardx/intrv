import "server-only";

/**
 * DeepSeek deprecated `deepseek-chat` and `deepseek-reasoner` on
 * 2026-07-24 15:59 UTC. They aliased V4's thinking/non-thinking modes; V4 is
 * one model with a `thinking` toggle instead. Every model id in the app comes
 * from here so a future rename is a one-line change.
 *
 * Verified live 2026-07-16: `deepseek-v4-flash` responds, accepts
 * `thinking: {type:"disabled"}`, and honours strict tool calls on /beta.
 */
export const MODELS = {
  flash: "deepseek-v4-flash",
  pro: "deepseek-v4-pro",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/** USD per token. Cache hits are ~50x cheaper than misses — prefix order matters. */
const PRICING: Record<
  ModelId,
  { cacheHit: number; cacheMiss: number; output: number }
> = {
  "deepseek-v4-flash": {
    cacheHit: 0.0028 / 1_000_000,
    cacheMiss: 0.14 / 1_000_000,
    output: 0.28 / 1_000_000,
  },
  "deepseek-v4-pro": {
    cacheHit: 0.003625 / 1_000_000,
    cacheMiss: 0.435 / 1_000_000,
    output: 0.87 / 1_000_000,
  },
};

export function estimateCostUsd(
  model: string,
  usage: {
    cacheHitTokens: number;
    cacheMissTokens: number;
    outputTokens: number;
  },
): number {
  const rate = PRICING[model as ModelId];
  if (!rate) return 0;
  return (
    usage.cacheHitTokens * rate.cacheHit +
    usage.cacheMissTokens * rate.cacheMiss +
    usage.outputTokens * rate.output
  );
}
