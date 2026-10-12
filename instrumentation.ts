/**
 * Server startup hook (runs once for the nodejs runtime).
 *
 * 1. Prefer IPv4 like curl does: some AI endpoints advertise both A and AAAA
 *    records and fail over broken IPv6 (see below).
 * 2. Start the background job worker (async solve queue).
 *
 * The `node:dns` import is lazy because this file is also compiled for the
 * Edge runtime, where Node.js core modules are not available.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { setDefaultResultOrder } = require("node:dns") as typeof import("node:dns");
  setDefaultResultOrder("ipv4first");

  // Don't start the worker during `next build` (register also runs there).
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // lazy dynamic require keeps Edge runtime from pulling in @prisma/client.
  // Relative path (not `@/`) so the bundler reliably resolves this require() call.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { startJobWorker } = require("./lib/server/job-worker");
  startJobWorker();
}
