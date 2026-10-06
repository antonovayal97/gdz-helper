import type { SolveProblemRequest, SolveProblemResult } from "@/types";
import { config } from "@/config";
import { AIProvider, AIProviderError } from "./provider";

/**
 * BitcoinComProvider — placeholder for the future Bitcoin.com AI integration.
 *
 * To connect it:
 *   1. implement the real API call here (same OpenAI-compatible shape
 *      that OpenRouterProvider uses),
 *   2. the rest of the app needs no changes (it talks to AIProvider).
 */
export class BitcoinComProvider implements AIProvider {
  readonly name = "bitcoincom";
  readonly model: string;

  constructor() {
    this.model = config.ai.bitcoincom.model || "bitcoincom/ai-model";
  }

  isAvailable(): boolean {
    return Boolean(config.ai.bitcoincom.apiKey) && Boolean(config.ai.bitcoincom.model);
  }

  async solveProblem(_request: SolveProblemRequest): Promise<SolveProblemResult> {
    throw new AIProviderError(
      "Bitcoin.com AI provider is not implemented yet. Set AI_PROVIDER=mock or openrouter.",
      "network",
    );
  }
}
