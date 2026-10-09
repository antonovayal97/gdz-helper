import { config } from "@/config";

interface Bucket {
  count: number;
  resetsAt: number;
}

/** In-memory sliding/window rate limiter. Good for a single instance; swap for Redis in production. */
const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  constructor(
    public readonly retryAfterSec: number,
    /** Optional user-facing text; otherwise the API layer shows a generic message. */
    public readonly friendlyMessage?: string,
  ) {
    super(friendlyMessage ?? "Too many requests");
    this.name = "RateLimitError";
  }
}

export interface RateLimitOptions {
  /** number of allowed requests per window */
  limit: number;
  /** window length in seconds */
  windowMs: number;
}

export function rateLimit(key: string, options: RateLimitOptions): void {
  if (!config.rateLimit.enabled) return;

  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetsAt <= now) {
    buckets.set(key, { count: 1, resetsAt: now + options.windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > options.limit) {
    const retryAfter = Math.ceil((existing.resetsAt - now) / 1000);
    throw new RateLimitError(retryAfter);
  }
}

/**
 * Record a "strike" without enforcing a limit — used for events that should
 * only be counted when they actually happen (e.g. a photo rejected by the
 * content filter). The window starts on the first strike.
 */
export function addStrike(key: string, windowMs: number): void {
  if (!config.rateLimit.enabled) return;

  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetsAt <= now) {
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
    return;
  }
  existing.count += 1;
}

/**
 * Read-only strike check, used to block a request BEFORE any work is done.
 * Returns 0 when under the limit, otherwise seconds until the window resets.
 */
export function strikeRetryAfterSec(key: string, limit: number): number {
  if (!config.rateLimit.enabled) return 0;

  const existing = buckets.get(key);
  if (!existing || existing.resetsAt <= Date.now()) return 0;
  if (existing.count < limit) return 0;
  return Math.max(1, Math.ceil((existing.resetsAt - Date.now()) / 1000));
}

/** Get a stable identifier for the current client (IP). */
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return ip;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
