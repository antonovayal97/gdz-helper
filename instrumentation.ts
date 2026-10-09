/**
 * Server startup hook (runs once for the nodejs runtime).
 *
 * Some AI endpoints (e.g. nano-gpt.com) advertise both A and AAAA records.
 * Node's fetch / undici prefers IPv6 and, on hosts with broken IPv6, fails with
 * "fetch failed" / ETIMEDOUT instead of falling back to IPv4. Prefer IPv4 like
 * curl does (available in Node >= 16.4, silently no-op elsewhere).
 *
 * The `node:dns` import is lazy because this file is also compiled for the
 * Edge runtime, where Node.js core modules are not available.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { setDefaultResultOrder } = require("node:dns") as typeof import("node:dns");
  setDefaultResultOrder("ipv4first");
}
