import { config } from "@/config";
import { OpenAICompatibleProvider } from "./openai-compatible";

/**
 * OpenRouterProvider — calls OpenRouter's OpenAI-compatible /chat/completions
 * endpoint with a vision-capable model. The request logic lives in
 * OpenAICompatibleProvider; this class only supplies OpenRouter config.
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      name: config.ai.openrouter.name,
      apiKey: config.ai.openrouter.apiKey,
      baseUrl: config.ai.openrouter.baseUrl,
      model: config.ai.openrouter.model,
      cheapModel: config.ai.openrouter.cheapModel,
      cheapMode: config.ai.cheapMode,
      extraHeaders: {
        "HTTP-Referer": config.app.url,
        "X-Title": "GDZ Mini App",
      },
    });
  }
}
