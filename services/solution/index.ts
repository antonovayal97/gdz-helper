import { Prisma } from "@prisma/client";
import { config } from "@/config";
import { prisma } from "@/lib/db/prisma";
import { RateLimitError, addStrike, strikeRetryAfterSec } from "@/lib/server/rate-limit";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import { getStorage } from "@/lib/storage";
import { recordBalanceTx } from "@/services/balance";
import type {
  SolutionDetail,
  SolutionSummary,
  SolutionJobDto,
  SolutionJobStatus,
  ExplanationMode,
  AiResult,
  AiUsage,
} from "@/types";

export const CREDIT_COST_PER_SOLUTION = 1;

export class SolutionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INSUFFICIENT_CREDITS"
      | "PROBLEM_NOT_RECOGNIZED"
      | "NOT_A_TASK"
      | "AI_ERROR"
      | "AI_TIMEOUT" = "AI_ERROR",
  ) {
    super(message);
    this.name = "SolutionError";
  }
}

export interface CreateSolutionInput {
  userId: string;
  imageData: Buffer;
  mimeType: string;
  mode: ExplanationMode;
  /**
   * When the photo has several tasks, the chosen task labels as seen on the
   * photo ("501", "9.15", "А5", ...). Empty/omitted → solve the whole photo
   * as a single solution.
   */
  taskNumbers?: string[] | null;
}

interface SolveAttempt {
  taskNumber: string | null;
  result: AiResult;
  usage: AiUsage;
}

/**
 * Best-effort image cleanup. Failures are logged, not thrown: a storage key
 * without DeleteObject permission must be visible in logs instead of
 * silently leaking orphaned objects.
 */
function deleteImageQuietly(key: string): Promise<void> {
  return getStorage()
    .delete(key)
    .catch((err) => {
      console.warn("[solution] failed to delete stored image:", err);
    });
}

/** Abuse-counter key for photos rejected by the content filter ("not a task"). */
function nonTaskKey(userId: string): string {
  return `notask:${userId}`;
}

/** Translate a provider error into the business error thrown to the API. */
function mapProviderError(err: AIProviderError): SolutionError {
  if (err.kind === "timeout") {
    return new SolutionError("AI_TIMEOUT", "AI_TIMEOUT");
  }
  if (err.message === "NOT_A_TASK") {
    return new SolutionError(
      "На фотографии нет учебного задания. Мы решаем только задачи, примеры и упражнения из учебников, тетрадей и тестов.",
      "NOT_A_TASK",
    );
  }
  if (err.message === "PROBLEM_NOT_RECOGNIZED") {
    return new SolutionError(
      "Не удалось распознать задачу. Попробуйте сделать фотографию лучше.",
      "PROBLEM_NOT_RECOGNIZED",
    );
  }
  if (err.message === "PROBLEM_NOT_SOLVED") {
    // The condition was read but the model could not finish the solution —
    // almost always because the photo cut the condition off mid-sentence.
    return new SolutionError(
      "Не удалось решить задачу: похоже, условие сфотографировано не целиком (не хватает данных). Переснимите задачу полностью и повторите попытку.",
      "PROBLEM_NOT_RECOGNIZED",
    );
  }
  if (err.message === "RESPONSE_TRUNCATED") {
    return new SolutionError(
      "Решение получилось слишком длинным и оборвалось. Попробуйте режим «только ответ» или отправьте фото ещё раз.",
      "AI_ERROR",
    );
  }
  // Surface the real provider error (HTTP status + body) so the cause is
  // diagnosable instead of a generic "AI_ERROR".
  return new SolutionError(err.message, "AI_ERROR");
}

/** Map any thrown value from the AI loop into a SolutionError the client understands. */
function toSolutionError(err: unknown): SolutionError {
  if (err instanceof SolutionError) return err;
  if (err instanceof AIProviderError) return mapProviderError(err);
  return new SolutionError("AI_ERROR", "AI_ERROR");
}

/**
 * Provider throttling (NanoGPT enforces a global 25 req/s) is temporary: the
 * job is paid-for user work, so instead of failing it we requeue with backoff.
 * Returns the delay until the next attempt in ms, or null when this failure
 * should not be retried (content errors, validation, etc).
 */
function requeueDelayMs(err: unknown, attempts: number): number | null {
  if (!(err instanceof AIProviderError)) return null;
  const transient = err.status === 429 || err.status === 503 || err.kind === "timeout";
  if (!transient) return null;
  const base = err.retryAfterMs ?? attempts * 5_000;
  const capped = Math.min(base, config.jobs.rateLimitMaxDelayMs);
  // ±50% jitter so a throttled wave does not retry in lockstep.
  return Math.round(capped * (0.5 + Math.random()));
}

/**
 * Enqueue a solve request and return immediately with a job id.
 * The actual AI work + credit deduction happens in a background worker
 * (see lib/server/job-worker), so the HTTP request is never held open for
 * the duration of the AI call. The client polls GET /api/solutions/status.
 */
export async function createSolutionJob(input: CreateSolutionInput): Promise<{ jobId: string }> {
  // Content-filter abuse guard: a user who keeps sending non-task photos is
  // paused before we spend storage + another (free but billable) AI call.
  const blockedFor = strikeRetryAfterSec(nonTaskKey(input.userId), config.limits.nonTaskLimit);
  if (blockedFor > 0) {
    throw new RateLimitError(
      blockedFor,
      `Вы слишком часто отправляли фото без учебных задач. ` +
        `Мы решаем только задачи, примеры и упражнения. Повторная попытка через ${Math.ceil(blockedFor / 60)} мин.`,
    );
  }

  // 1. Store the image up-front so the worker does not need the raw upload
  //    body (and so the request can return before the AI even starts).
  let storedKey: string | null = null;
  let imageUrl: string;
  try {
    const stored = await getStorage().upload({
      data: input.imageData,
      mimeType: input.mimeType,
      folder: "solutions",
    });
    storedKey = stored.key;
    imageUrl = stored.url;
  } catch {
    throw new SolutionError("Не удалось сохранить изображение. Попробуйте ещё раз.");
  }

  try {
    // 2. Enqueue the job. The worker will pick it up and run the AI.
    const taskNumbers: string[] | null =
      input.taskNumbers && input.taskNumbers.length > 0 ? input.taskNumbers : null;

    const row = await prisma.solutionJob.create({
      data: {
        userId: input.userId,
        status: "queued",
        mode: input.mode,
        // nullable Json column: SQL NULL via Prisma.DbNull (plain null is not accepted)
        taskNumbers: taskNumbers ?? Prisma.DbNull,
        imageKey: storedKey!,
        imageUrl,
        attempts: 0,
      },
      select: { id: true },
    });

    return { jobId: row.id };
  } catch (err) {
    console.error("[solution] enqueue failed:", err);
    // Do not leak an orphaned image when the job row could not be created.
    await deleteImageQuietly(storedKey);
    throw new SolutionError("AI_ERROR", "AI_ERROR");
  }
}

/**
 * Process a single queued job: claim it atomically, run the AI for each chosen
 * task, save solutions + deduct credits in one transaction and mark the job done.
 */
export async function processSolutionJob(jobId: string): Promise<void> {
  const claimed = await prisma.solutionJob.updateMany({
    where: { id: jobId, status: "queued" },
    data: { status: "processing", attempts: { increment: 1 }, startedAt: new Date() },
  });
  if (claimed.count === 0) return; // already claimed or gone — do not process twice

  const job = await prisma.solutionJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  // Retry budget exhausted (throttle requeues or repeated crash-reclaims) —
  // fail the job instead of spinning forever against the provider.
  if (job.attempts > config.jobs.maxAttempts) {
    await prisma.solutionJob.update({
      where: { id: jobId },
      data: {
        status: "error",
        errorCode: "AI_ERROR",
        errorMessage:
          "Сервис временно перегружен. Попробуйте отправить фото через несколько минут.",
        finishedAt: new Date(),
      },
    });
    await deleteImageQuietly(job.imageKey);
    return;
  }

  const tasks: (string | null)[] =
    Array.isArray(job.taskNumbers as unknown) && (job.taskNumbers as string[]).length > 0
      ? (job.taskNumbers as string[])
      : [null];
  const mode = job.mode as ExplanationMode;
  const provider = getAIProvider();

  const attempts: SolveAttempt[] = [];
  const failedTaskNumbers: string[] = [];
  let firstFailure: unknown = null;
  // True once the save+deduct transaction committed — after that the stored
  // image is referenced by Solution rows and must never be deleted.
  let solutionsCommitted = false;

  try {
    // 1. Read the stored image once, then call the AI per chosen task.
    let image: { data: Buffer; mimeType: string } | null = null;
    try {
      const stored = await getStorage().read(job.imageKey);
      image = { data: stored.data, mimeType: stored.mimeType };
    } catch (err) {
      console.error("[solution] read stored image failed:", err);
      await prisma.solutionJob.update({
        where: { id: jobId },
        data: {
          status: "error",
          errorCode: "AI_ERROR",
          errorMessage: "Не удалось прочитать изображение. Попробуйте ещё раз.",
        },
      });
      await deleteImageQuietly(job.imageKey);
      return;
    }

    for (const taskNumber of tasks) {
      try {
        const { result, usage } = await provider.solveProblem({
          image,
          mode,
          taskNumber,
        });
        attempts.push({ taskNumber, result, usage });
      } catch (err) {
        firstFailure ??= err;
        if (taskNumber != null) failedTaskNumbers.push(taskNumber);
      }
    }

    // Nothing solved → record the failure on the job (no credit deduction)
    // and clean up the stored image, mirroring the old synchronous behaviour.
    if (attempts.length === 0) {
      const failure = toSolutionError(firstFailure);

      // Transient provider failure (429/503/timeout): requeue with backoff,
      // keeping the stored image for the retry.
      const delayMs = requeueDelayMs(firstFailure, job.attempts);
      if (delayMs !== null && job.attempts < config.jobs.maxAttempts) {
        await prisma.solutionJob.update({
          where: { id: jobId },
          data: {
            status: "queued",
            startedAt: null,
            runAfterAt: new Date(Date.now() + delayMs),
          },
        });
        console.warn(
          `[solution] job ${jobId} throttled (${(firstFailure as AIProviderError).status ?? "timeout"})` +
            ` — retry in ${delayMs}ms (attempt ${job.attempts}/${config.jobs.maxAttempts})`,
        );
        return;
      }

      if (failure.code === "NOT_A_TASK") {
        addStrike(nonTaskKey(job.userId), config.limits.nonTaskWindowMs);
      }
      await prisma.solutionJob.update({
        where: { id: jobId },
        data: {
          status: "error",
          errorCode: failure.code,
          // Budget exhausted on a transient failure → friendly overload text.
          errorMessage:
            delayMs !== null
              ? "Сервис временно перегружен. Попробуйте отправить фото через несколько минут."
              : failure.message,
        },
      });
      await deleteImageQuietly(job.imageKey);
      return;
    }

    // 2. Save every solved task + deduct credits atomically.
    const outcome = await prisma.$transaction(async (tx) => {
      const count = attempts.length;
      const spent = await tx.user.updateMany({
        where: { id: job.userId, balance: { gte: count * CREDIT_COST_PER_SOLUTION } },
        data: { balance: { decrement: count * CREDIT_COST_PER_SOLUTION } },
      });
      if (spent.count === 0) {
        throw new SolutionError("У вас закончились решения", "INSUFFICIENT_CREDITS");
      }

      const created = [];
      for (const a of attempts) {
        const row = await tx.solution.create({
          data: {
            userId: job.userId,
            imageUrl: job.imageUrl,
            subject: a.result.subject,
            recognizedProblem: a.result.recognizedProblem,
            answer: a.result.answer,
            steps: a.result.steps as unknown as Prisma.InputJsonValue,
            explanationMode: mode,
            provider: a.usage.provider,
            model: a.usage.model,
            inputTokens: a.usage.inputTokens,
            outputTokens: a.usage.outputTokens,
            estimatedCost: a.usage.estimatedCost,
            latencyMs: a.usage.latencyMs,
            confidence: a.result.confidence,
            aiStatus: a.usage.status,
          },
        });
        created.push(row);
      }

      const balanceAfter = await tx.user.findUnique({
        where: { id: job.userId },
        select: { balance: true },
      });

      await recordBalanceTx(tx, {
        userId: job.userId,
        type: "solution",
        amount: -count * CREDIT_COST_PER_SOLUTION,
        balanceAfter: balanceAfter?.balance ?? 0,
        // link to the first created solution row (one entry per solve request)
        refId: created[0]?.id,
      });

      return { created, balance: balanceAfter?.balance ?? 0 };
    });

    // 3. Mark done with result payload for the status endpoint.
    solutionsCommitted = true;
    await prisma.solutionJob.update({
      where: { id: jobId },
      data: {
        status: "done",
        solutionIds: outcome.created.map((s) => s.id),
        failedTaskNumbers,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    // Job-level unexpected failure (transaction error etc). Never charged without
    // a record; the image is cleaned up unless solutions already reference it.
    const failure = toSolutionError(err);
    console.error("[solution] job failed:", err);
    await prisma.solutionJob
      .update({
        where: { id: jobId },
        data: {
          status: "error",
          errorCode: failure.code,
          errorMessage: failure.message,
          finishedAt: new Date(),
        },
      })
      .catch(() => {});
    if (!solutionsCommitted) {
      await deleteImageQuietly(job.imageKey);
    }
  }
}

/** Read a job's status as exposed to the client. Returns null if not found/not owned. */
export async function getSolutionJobStatus(
  userId: string,
  jobId: string,
): Promise<SolutionJobDto | null> {
  const row = await prisma.solutionJob.findFirst({
    where: { id: jobId, userId },
    select: {
      id: true,
      status: true,
      solutionIds: true,
      failedTaskNumbers: true,
      errorCode: true,
      errorMessage: true,
      createdAt: true,
    },
  });
  if (!row) return null;

  // Live queue snapshot. The worker claims jobs FIFO by createdAt, so the
  // user's position is the number of live jobs created before theirs + 1.
  let queuePosition: number | null = null;
  let queueSize = 0;
  if (row.status === "queued" || row.status === "processing") {
    const [ahead, total] = await Promise.all([
      prisma.solutionJob.count({
        where: {
          status: { in: ["queued", "processing"] },
          createdAt: { lt: row.createdAt },
        },
      }),
      prisma.solutionJob.count({
        where: { status: { in: ["queued", "processing"] } },
      }),
    ]);
    queueSize = total;
    // "processing" means the job already occupies a worker slot — no waiting.
    queuePosition = row.status === "queued" ? ahead + 1 : null;
  }

  return {
    id: row.id,
    status: row.status as SolutionJobStatus,
    solutionIds: Array.isArray(row.solutionIds) ? (row.solutionIds as string[]) : [],
    failedTaskNumbers: Array.isArray(row.failedTaskNumbers)
      ? (row.failedTaskNumbers as string[])
      : [],
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    queuePosition,
    queueSize,
  };
}

/** Detect task labels on a photo. Best-effort + free — failures never block solving. */
export async function detectProblemNumbers(input: {
  imageData: Buffer;
  mimeType: string;
}): Promise<string[]> {
  const provider = getAIProvider();
  try {
    const { numbers } = await provider.detectProblems({
      image: { data: input.imageData, mimeType: input.mimeType },
    });
    return numbers ?? [];
  } catch (err) {
    // Detection is best-effort: on any failure, fall back to solving the whole photo.
    console.error("[solution] detect numbers failed:", err);
    return [];
  }
}

export async function listSolutions(userId: string, limit = 20): Promise<SolutionSummary[]> {
  const rows = await prisma.solution.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      subject: true,
      recognizedProblem: true,
      answer: true,
      confidence: true,
      createdAt: true,
    },
  });
  return rows.map(toSummary);
}

export async function getSolution(
  userId: string,
  solutionId: string,
): Promise<SolutionDetail | null> {
  const row = await prisma.solution.findFirst({
    where: { id: solutionId, userId },
    select: {
      id: true,
      imageUrl: true,
      subject: true,
      recognizedProblem: true,
      answer: true,
      steps: true,
      explanationMode: true,
      provider: true,
      model: true,
      estimatedCost: true,
      confidence: true,
      createdAt: true,
    },
  });
  if (!row) return null;
  return toDetail(row);
}

interface SolutionRow {
  id: string;
  subject: string;
  recognizedProblem: string;
  answer: string;
  confidence: number | null;
  createdAt: Date;
  imageUrl?: string;
  steps?: Prisma.JsonValue;
  explanationMode?: string | null;
  model?: string | null;
  provider?: string | null;
  estimatedCost?: number | null;
}

function toSummary(row: SolutionRow): SolutionSummary {
  return {
    id: row.id,
    subject: row.subject,
    recognizedProblem: row.recognizedProblem,
    answer: row.answer,
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDetail(row: SolutionRow): SolutionDetail {
  const base = toSummary(row);
  return {
    ...base,
    imageUrl: row.imageUrl ?? "",
    steps: Array.isArray(row.steps) ? (row.steps as unknown as SolutionDetail["steps"]) : [],
    explanationMode: row.explanationMode ?? null,
    model: row.model ?? null,
    provider: row.provider ?? null,
    estimatedCost: row.estimatedCost ?? null,
  };
}
