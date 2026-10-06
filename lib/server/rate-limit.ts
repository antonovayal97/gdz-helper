import { config } from "@/config";

interface Bucket {
  count: number;
  resetsAt: number;
}

/** In-memory sliding/window rate limiter. Good for a single instance; swap for Redis in production. */
const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSec: number) {
    super("Too many requests");
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

/** Get a stable identifier for the current client (IP). */
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return ip;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
