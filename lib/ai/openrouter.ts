import { config } from "@/config";
import { calculateAiCost } from "@/config/ai-models";
import { aiResultSchema } from "./schema";
import { AIProvider, AIProviderError, failedUsage } from "./provider";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { SolveProblemRequest, SolveProblemResult, AiUsage } from "@/types";

function imageToDataUrl(data: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

/**
 * OpenRouterProvider — calls OpenRouter's OpenAI-compatible /chat/completions
 * endpoint with a vision-capable model.
 */
export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    this.apiKey = config.ai.openrouter.apiKey;
    this.model = config.ai.openrouter.model;
    this.baseUrl = config.ai.openrouter.baseUrl;
    this.timeoutMs = config.ai.timeoutMs;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async solveProblem(
    request: SolveProblemRequest,
    signal?: AbortSignal,
  ): Promise<SolveProblemResult> {
    if (!this.isAvailable()) {
      throw new AIProviderError("OpenRouter API key is not configured", "network");
    }

    const started = Date.now();

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);
    // allow the caller to abort too
    const onOuterAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onOuterAbort);
    }

    const result = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": config.app.url,
        "X-Title": "GDZ Mini App",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: buildUserPrompt(request.mode) },
              {
                type: "image_url",
                image_url: { url: imageToDataUrl(request.image.data, request.image.mimeType) },
              },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.3,
        // ask the model for JSON output when supported
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    }).catch((err) => {
      throw err;
    });

    clearTimeout(timeoutHandle);
    if (signal) signal.removeEventListener("abort", onOuterAbort);

    const latencyMs = Date.now() - started;

    if (!result.ok) {
      const text = await result.text().catch(() => "");
      throw new AIProviderError(
        `OpenRouter HTTP ${result.status}: ${text.slice(0, 300)}`,
        "http",
        result.status,
      );
    }

    let data: {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      data = await result.json();
    } catch {
      throw new AIProviderError("Failed to parse OpenRouter response", "parse");
    }

    const rawText = data.choices?.[0]?.message?.content ?? "";
    let aiResult;
    try {
      // strip any code fences the model may have added
      const cleaned = rawText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "");
      aiResult = aiResultSchema.parse(JSON.parse(cleaned));
    } catch {
      throw new AIProviderError("AI returned invalid JSON or missing fields", "response");
    }

    // If the model itself says it couldn't read the problem, surface a clean error.
    if (!aiResult.recognizedProblem && aiResult.confidence <= 0.2) {
      throw new AIProviderError("PROBLEM_NOT_RECOGNIZED", "response");
    }

    const inputTokens = data.usage?.prompt_tokens ?? null;
    const outputTokens = data.usage?.completion_tokens ?? null;
    const estimatedCost =
      inputTokens != null && outputTokens != null
        ? calculateAiCost(this.model, inputTokens, outputTokens)
        : null;

    const usage: AiUsage = {
      provider: this.name,
      model: this.model,
      inputTokens,
      outputTokens,
      estimatedCost,
      latencyMs,
      status: "ok",
    };

    return { result: aiResult, usage };
  }
}

export { failedUsage };
