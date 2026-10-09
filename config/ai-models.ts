/**
 * Model pricing configuration (USD per 1M tokens).
 * Used by calculateAiCost() — never hardcode prices in business logic.
 *
 * Values: { inputPer1M, outputPer1M } — USD per 1M tokens, using OpenRouter
 * list prices as reference. Keep updated as pricing changes.
 */
export const MODEL_PRICING_USD: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "openai/gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "openai/gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "openai/gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "openai/gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
  "anthropic/claude-3.5-haiku": { inputPer1M: 0.8, outputPer1M: 4 },
  "anthropic/claude-3.5-sonnet": { inputPer1M: 3, outputPer1M: 15 },
  "google/gemini-2.0-flash-001": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "google/gemini-2.5-flash-lite": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "gemini-2.5-flash-lite": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "qwen/qwen3-vl-235b-a22b-instruct": { inputPer1M: 0.2, outputPer1M: 0.88 },
  "meta-llama/llama-3.3-70b-instruct": { inputPer1M: 0.25, outputPer1M: 0.4 },
};

/** Fallback price used when the model isn't in the table above. */
export const DEFAULT_PRICING_USD = { inputPer1M: 0.5, outputPer1M: 1.5 };

/**
 * Estimate the cost of one AI call in USD.
 * Stored for later economic analysis; not used for user billing.
 */
export function calculateAiCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING_USD[model] ?? DEFAULT_PRICING_USD;
  const cost =
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M;
  return Number(cost.toFixed(6));
}
