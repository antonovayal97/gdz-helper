import { config } from "@/config";
import { prisma } from "@/lib/db/prisma";
import { processSolutionJob } from "@/services/solution";

/**
 * Simple Postgres-backed job worker: polls the solution_jobs table, claims
 * queued jobs atomically (so multiple instances never double-process) and
 * runs up to `concurrency` jobs in parallel.
 */
let running = false;
const inFlight = new Set<string>();

async function tick(): Promise<void> {
  try {
    // Recover jobs left "processing" by a crashed process.
    const stale = await prisma.solutionJob.updateMany({
      where: {
        status: "processing",
        startedAt: { lt: new Date(Date.now() - config.jobs.staleAfterMs) },
      },
      data: { status: "queued", startedAt: null, finishedAt: null, runAfterAt: null },
    });
    if (stale.count > 0) {
      console.warn(`[jobs] reclaimed ${stale.count} stale processing jobs`);
    }

    const free = config.jobs.concurrency - inFlight.size;
    if (free <= 0) return;

    const queued = await prisma.solutionJob.findMany({
      where: {
        status: "queued",
        // Honor the backoff boundary of throttled (requeued) jobs.
        OR: [{ runAfterAt: null }, { runAfterAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
      take: free,
      select: { id: true },
    });

    for (const { id } of queued) {
      inFlight.add(id);
      void processSolutionJob(id).finally(() => inFlight.delete(id));
    }
  } catch (err) {
    console.error("[jobs] worker tick failed:", err);
  } finally {
    // reschedule — even on unexpected throw, keep the loop alive
    setTimeout(() => void tick(), config.jobs.pollIntervalMs).unref?.();
  }
}

export function startJobWorker(): void {
  if (running) return;
  running = true;
  void tick();
}
