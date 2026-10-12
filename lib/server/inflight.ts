import { RateLimitError } from "./rate-limit";

/**
 * Process-wide in-flight cap for a named resource (in-memory — the same
 * single-instance assumption as the rate limiter). Used to keep bursty
 * synchronous AI calls (e.g. task-number detection) from hammering the
 * provider's global RPS limit that the solve queue already respects.
 */
const inFlight = new Map<string, number>();

/**
 * Run `fn` while occupying one slot of `key`'s capacity. When all slots are
 * taken, throws RateLimitError (429) immediately — callers should degrade
 * fast rather than queue synchronous work.
 */
export async function withInflightSlot<T>(
  key: string,
  max: number,
  fn: () => Promise<T>,
  retryAfterSec = 2,
): Promise<T> {
  const current = inFlight.get(key) ?? 0;
  if (current >= max) throw new RateLimitError(retryAfterSec);

  inFlight.set(key, current + 1);
  try {
    return await fn();
  } finally {
    const left = (inFlight.get(key) ?? 1) - 1;
    if (left <= 0) inFlight.delete(key);
    else inFlight.set(key, left);
  }
}
