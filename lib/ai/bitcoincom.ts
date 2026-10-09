import { config } from "@/config";
import { OpenAICompatibleProvider } from "./openai-compatible";

/**
 * BitcoinComProvider — calls the Bitcoin.com AI API (ai.bitcoin.com).
 *
 * Bitcoin.com AI is an OpenRouter-style / nano-gpt partner: it is
 * OpenAI-compatible at `https://nano-gpt.com/api/v1`, so the request
 * logic is fully shared with OpenAICompatibleProvider. An ai.bitcoin.com
 * API key works directly on that endpoint.
 */
export class BitcoinComProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      name: config.ai.bitcoincom.name,
      apiKey: config.ai.bitcoincom.apiKey,
      baseUrl: config.ai.bitcoincom.baseUrl,
      model: config.ai.bitcoincom.model,
      cheapModel: config.ai.bitcoincom.cheapModel,
      cheapMode: config.ai.cheapMode,
    });
  }
}
