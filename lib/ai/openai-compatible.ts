import { config } from "@/config";
import { calculateAiCost } from "@/config/ai-models";
import { aiNumbersSchema, aiResultSchema } from "./schema";
import { AIProvider, AIProviderError } from "./provider";
import { DETECT_PROMPT, DETECT_USER_PROMPT, SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type {
  AiUsage,
  DetectProblemsRequest,
  DetectProblemsResult,
  SolveProblemRequest,
  SolveProblemResult,
} from "@/types";

function imageToDataUrl(data: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

export interface OpenAICompatibleProviderOptions {
  /** Provider slug used in the DB and error messages, e.g. "openrouter", "bitcoincom". */
  name: string;
  apiKey: string;
  baseUrl: string;
  /** Default model slug, e.g. "qwen/qwen3-vl-235b-a22b-instruct". */
  model: string;
  /**
   * Model used for "cheap" tasks (answer mode). When `cheapMode` is enabled and
   * the user asks for a quick answer, the "answer" mode routes here.
   */
  cheapModel?: string;
  /** Enable cheap model routing. Default: false. */
  cheapMode?: boolean;
  /** Extra HTTP headers (e.g. for OpenRouter attribution). */
  extraHeaders?: Record<string, string>;
}

/**
 * Base class for OpenAI-compatible /chat/completions providers
 * (OpenRouter, Bitcoin.com AI / nano-gpt, ...).
 *
 * Subclasses only supply constructor options; the request, timeout,
 * JSON parsing and cost logic is shared here.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  readonly model: string;
  readonly cheapModel: string | null;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly retries: number;
  private readonly retryDelayMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly cheapMode: boolean;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.name = options.name;
    this.model = options.model;
    this.cheapModel = options.cheapModel ?? null;
    this.cheapMode = options.cheapMode ?? false;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.timeoutMs = config.ai.timeoutMs;
    this.maxTokens = config.ai.maxTokens;
    this.retries = Math.max(0, config.ai.retries);
    this.retryDelayMs = Math.max(0, config.ai.retryDelayMs);
    this.extraHeaders = options.extraHeaders ?? {};
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async solveProblem(
    request: SolveProblemRequest,
    signal?: AbortSignal,
  ): Promise<SolveProblemResult> {
    if (!this.isAvailable()) {
      throw new AIProviderError(`${this.name} API key is not configured`, "network");
    }

    // Cheap tasks (answer mode only) use a cheap model, e.g. Gemini 2.5 Flash Lite.
    const isCheap = this.cheapMode && request.mode === "answer" && this.cheapModel;
    const model = isCheap ? (this.cheapModel as string) : this.model;

    const started = Date.now();

    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    const wireAbort = () => {
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", onOuterAbort, { once: true });
      }
    };
    const unwireAbort = () => {
      if (signal) signal.removeEventListener("abort", onOuterAbort);
    };

    // Transient connection failures (DNS down, flaky CDN, etc.) are worth
    // retrying: a single blip shouldn't fail a paid-in-credits request.
    const attempts = this.retries + 1;
    let response: Response | undefined;
    let lastError: AIProviderError | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (attempt > 1) {
        if (signal?.aborted) break;
        await new Promise((r) => setTimeout(r, this.retryDelayMs * (attempt - 1)));
        console.warn(`[ai] ${this.name} retrying (${attempt}/${attempts})...`);
      }

      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);
      wireAbort();

      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...this.extraHeaders,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "text", text: buildUserPrompt(request.mode, request.taskNumber) },
                  {
                    type: "image_url",
                    image_url: { url: imageToDataUrl(request.image.data, request.image.mimeType) },
                  },
                ],
              },
            ],
            max_tokens: this.maxTokens,
            temperature: 0.3,
            // ask the model for JSON output when supported
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeoutHandle);
        unwireAbort();

        // Distinguish our own timeout abort from network failures / outer aborts.
        if (controller.signal.aborted && !signal?.aborted) {
          throw new AIProviderError(`${this.name} request timed out`, "timeout");
        }
        if (err instanceof AIProviderError) throw err;
        const error = new AIProviderError(
          `${this.name} network error: ${describeNetworkError(err, this.baseUrl)}`,
          "network",
        );
        // Keep the original error for diagnostics (err.cause is Node errno info).
        (error as Error & { cause?: unknown }).cause = err;
        if (shouldRetry(err)) {
          lastError = error;
          continue;
        }
        throw error;
      }

      clearTimeout(timeoutHandle);
      unwireAbort();

      if (response.ok) break;
      const text = await response.text().catch(() => "");
      throw new AIProviderError(
        `${this.name} HTTP ${response.status}: ${text.slice(0, 300)}`,
        "http",
        response.status,
      );
    }

    if (!response) {
      throw lastError ?? new AIProviderError(`${this.name} request failed`, "network");
    }

    const latencyMs = Date.now() - started;

    let data: {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      data = await response.json();
    } catch {
      throw new AIProviderError(`Failed to parse ${this.name} response`, "parse");
    }

    const choice = data.choices?.[0];
    const rawText = choice?.message?.content ?? "";
    const truncated = choice?.finish_reason === "length";
    let parsed;
    try {
      // strip any code fences the model may have added
      const cleaned = rawText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "");
      parsed = aiResultSchema.parse(JSON.parse(cleaned));
    } catch (err) {
      // Log the raw payload so schema mismatches are diagnosable instead of
      // an opaque "invalid JSON" 502.
      console.warn(
        `[ai] ${this.name} response failed validation:`,
        err instanceof Error ? err.message : String(err),
        `| finish_reason: ${choice?.finish_reason ?? "?"}`,
        `| raw: ${rawText.slice(0, 500)}`,
      );
      // A JSON cut off by the output limit is a different failure than a
      // genuinely malformed reply: say so instead of "invalid JSON".
      if (truncated) {
        throw new AIProviderError("RESPONSE_TRUNCATED", "response");
      }
      throw new AIProviderError("AI returned invalid JSON or missing fields", "response");
    }

    // Content filter: photos that do not hold a school task are rejected.
    // Throwing here means no credit is ever deducted for them.
    const { isTask, ...aiResult } = parsed;
    if (!isTask) {
      throw new AIProviderError("NOT_A_TASK", "response");
    }

    // If the model itself says it couldn't read the problem, surface a clean error.
    if (!aiResult.recognizedProblem && aiResult.confidence <= 0.2) {
      throw new AIProviderError("PROBLEM_NOT_RECOGNIZED", "response");
    }

    // The model read the photo but returned no final answer (typically: the
    // condition was cut off on the photo, so part б) is unsolvable). That is
    // an honest refusal, not a broken reply — report it cleanly.
    if (!aiResult.answer) {
      throw new AIProviderError("PROBLEM_NOT_SOLVED", "response");
    }

    const inputTokens = data.usage?.prompt_tokens ?? null;
    const outputTokens = data.usage?.completion_tokens ?? null;
    const estimatedCost =
      inputTokens != null && outputTokens != null
        ? calculateAiCost(model, inputTokens, outputTokens)
        : null;

    const usage: AiUsage = {
      provider: this.name,
      model,
      inputTokens,
      outputTokens,
      estimatedCost,
      latencyMs,
      status: "ok",
    };

    return { result: aiResult, usage };
  }

  async detectProblems(
    request: DetectProblemsRequest,
    signal?: AbortSignal,
  ): Promise<DetectProblemsResult> {
    if (!this.isAvailable()) {
      throw new AIProviderError(`${this.name} API key is not configured`, "network");
    }

    // Detection is a small task — prefer the cheap model when available.
    const model = this.cheapModel ?? this.model;
    const started = Date.now();

    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    const wireAbort = () => {
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", onOuterAbort, { once: true });
      }
    };
    const unwireAbort = () => {
      if (signal) signal.removeEventListener("abort", onOuterAbort);
    };

    const attempts = this.retries + 1;
    let response: Response | undefined;
    let lastError: AIProviderError | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (attempt > 1) {
        if (signal?.aborted) break;
        await new Promise((r) => setTimeout(r, this.retryDelayMs * (attempt - 1)));
        console.warn(`[ai] ${this.name} detecting retry (${attempt}/${attempts})...`);
      }

      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);
      wireAbort();

      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...this.extraHeaders,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: DETECT_PROMPT },
              {
                role: "user",
                content: [
                  { type: "text", text: DETECT_USER_PROMPT },
                  {
                    type: "image_url",
                    image_url: {
                      url: imageToDataUrl(request.image.data, request.image.mimeType),
                    },
                  },
                ],
              },
            ],
            max_tokens: 400,
            temperature: 0,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeoutHandle);
        unwireAbort();

        if (controller.signal.aborted && !signal?.aborted) {
          throw new AIProviderError(`${this.name} detection request timed out`, "timeout");
        }
        if (err instanceof AIProviderError) throw err;
        const error = new AIProviderError(
          `${this.name} detection network error: ${describeNetworkError(err, this.baseUrl)}`,
          "network",
        );
        (error as Error & { cause?: unknown }).cause = err;
        if (shouldRetry(err)) {
          lastError = error;
          continue;
        }
        throw error;
      }

      clearTimeout(timeoutHandle);
      unwireAbort();

      if (response.ok) break;
      const text = await response.text().catch(() => "");
      throw new AIProviderError(
        `${this.name} detection HTTP ${response.status}: ${text.slice(0, 300)}`,
        "http",
        response.status,
      );
    }

    if (!response) {
      throw lastError ?? new AIProviderError(`${this.name} detection request failed`, "network");
    }

    const latencyMs = Date.now() - started;

    let data;
    try {
      data = await response.json();
    } catch {
      throw new AIProviderError(`Failed to parse ${this.name} response`, "parse");
    }

    const rawText = data?.choices?.[0]?.message?.content ?? "";
    let numbers: string[];
    try {
      const cleaned = rawText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "");
      numbers = aiNumbersSchema.parse(JSON.parse(cleaned)).numbers;
    } catch {
      // Fallback: if the model didn't produce valid JSON, treat as "no numbers found".
      numbers = [];
    }

    const inputTokens = data?.usage?.prompt_tokens ?? null;
    const outputTokens = data?.usage?.completion_tokens ?? null;
    const estimatedCost =
      inputTokens != null && outputTokens != null
        ? calculateAiCost(model, inputTokens, outputTokens)
        : null;

    const usage: AiUsage = {
      provider: this.name,
      model,
      inputTokens,
      outputTokens,
      estimatedCost,
      latencyMs,
      status: "ok",
    };

    return { numbers, usage };
  }
}

function shouldRetry(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string } })?.cause;
  const code = cause?.code;
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_SOCKET" ||
    code === "ECONNABORTED"
  );
}

function describeNetworkError(err: unknown, baseUrl: string): string {
  const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
  const code = cause?.code;
  const known = code === "ETIMEDOUT"
    ? "connection timed out (ETIMEDOUT)"
    : code === "ECONNREFUSED"
      ? "connection refused (ECONNREFUSED)"
      : code === "ECONNRESET"
        ? "connection reset (ECONNRESET)"
        : code === "ENOTFOUND"
          ? "DNS lookup failed (ENOTFOUND)"
          : code === "EAI_AGAIN"
            ? "temporary DNS failure (EAI_AGAIN)"
            : code?.startsWith("UND_ERR_")
              ? `${code} (undici)`
              : code
                ? `${code}`
                : "";
  const detail = known
    || cause?.message?.slice(0, 120)
    || ((err as Error)?.message ?? "");
  return `failed to reach ${baseUrl}${detail ? ` — ${detail}` : ""}`;
}
