import { config } from "@/config";
import type { AIProvider } from "./provider";
import { AIProviderError } from "./provider";
import { MockAIProvider } from "./mock";
import { OpenRouterProvider } from "./openrouter";
import { BitcoinComProvider } from "./bitcoincom";

export type { AIProvider };
export { AIProviderError };
export { calculateAiCost } from "@/config/ai-models";

/**
 * Factory: returns the configured AI provider (from AI_PROVIDER env).
 * Business code should always call getAIProvider() instead of constructing
 * providers directly.
 */
let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;

  switch (config.ai.provider) {
    case "openrouter":
      cached = new OpenRouterProvider();
      break;
    case "bitcoincom":
      cached = new BitcoinComProvider();
      break;
    case "mock":
    default:
      cached = new MockAIProvider();
      break;
  }

  if (!cached.isAvailable()) {
    // Fail loud in production, degrade to mock in development.
    if (config.isProd) {
      throw new AIProviderError(
        `AI provider "${config.ai.provider}" is not configured (missing key).`,
        "network",
      );
    }
    console.warn(
      `[ai] Provider "${config.ai.provider}" unavailable, falling back to mock for development.`,
    );
    cached = new MockAIProvider();
  }

  return cached;
}
