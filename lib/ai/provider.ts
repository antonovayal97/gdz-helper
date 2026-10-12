import type {
  AiUsage,
  DetectProblemsRequest,
  DetectProblemsResult,
  SolveProblemRequest,
  SolveProblemResult,
} from "@/types";

/**
 * AIProvider — the abstraction for every AI backend (OpenRouter, Bitcoin.com AI, ...).
 *
 * Business logic depends only on this interface. To add a new provider:
 *   1. implement AIProvider,
 *   2. register it in lib/ai/index.ts.
 * No other code changes are required.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Solve a school problem from an image.
   * Throws on failure — the caller must NOT deduct a credit on error.
   */
  solveProblem(request: SolveProblemRequest, signal?: AbortSignal): Promise<SolveProblemResult>;

  /**
   * Best-effort detection of task numbers visible on a photo.
   * No credit is charged for this call.
   */
  detectProblems(request: DetectProblemsRequest, signal?: AbortSignal): Promise<DetectProblemsResult>;

  /** Cheap availability check (e.g. API key configured). */
  isAvailable(): boolean;
}

export type AIErrorKind = "network" | "timeout" | "http" | "parse" | "response";

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: AIErrorKind = "network",
    public readonly status?: number,
    /** Parsed `Retry-After` header in ms (429/5xx throttling), when present. */
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

/** Standard `usage` object for a failed call. */
export function failedUsage(provider: string, model: string, kind: AIErrorKind): AiUsage {
  return {
    provider,
    model,
    inputTokens: null,
    outputTokens: null,
    estimatedCost: null,
    latencyMs: null,
    status: kind === "timeout" ? "timeout" : "failed",
  };
}
