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
  // Surface the real provider error (HTTP status + body) so the cause is
  // diagnosable instead of a generic "AI_ERROR".
  return new SolutionError(err.message, "AI_ERROR");
}

/**
 * The full solve pipeline. The credits are deducted ONLY for the tasks the AI
 * succeeded on, atomically with the solution creation:
 *   - an AI error never costs a credit,
 *   - failed tasks are skipped (and reported back, not charged),
 *   - double-charging is impossible (atomic balance check + deduct).
 */
export async function createSolution(input: CreateSolutionInput): Promise<{
  solutions: SolutionDetail[];
  balance: number;
  /** Task labels the AI failed to solve — never charged. */
  failedTaskNumbers: string[];
}> {
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

  const provider = getAIProvider();

  // 1. Store the image. If anything below fails we clean it up.
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
    // 2. Call the AI once per chosen task (whole photo when no labels given).
    const tasks: (string | null)[] =
      input.taskNumbers && input.taskNumbers.length > 0 ? input.taskNumbers : [null];

    const attempts: SolveAttempt[] = [];
    const failedTaskNumbers: string[] = [];
    let firstFailure: unknown = null;

    for (const taskNumber of tasks) {
      try {
        const { result, usage } = await provider.solveProblem({
          image: { data: input.imageData, mimeType: input.mimeType },
          mode: input.mode,
          taskNumber,
        });
        attempts.push({ taskNumber, result, usage });
      } catch (err) {
        firstFailure ??= err;
        if (taskNumber != null) failedTaskNumbers.push(taskNumber);
      }
    }

    // Nothing solved → surface the first failure so the user sees a reason.
    if (attempts.length === 0) {
      const failure =
        firstFailure instanceof SolutionError
          ? firstFailure
          : firstFailure instanceof AIProviderError
            ? mapProviderError(firstFailure)
            : new SolutionError("AI_ERROR", "AI_ERROR");
      // Chronic "not a task" spam is eventually blocked up-front (see guard
      // above); here we only record the strike for this rejection.
      if (failure.code === "NOT_A_TASK") {
        addStrike(nonTaskKey(input.userId), config.limits.nonTaskWindowMs);
      }
      throw failure;
    }

    // 3. Save every solved task + deduct credits atomically.
    const outcome = await prisma.$transaction(async (tx) => {
      const count = attempts.length;
      const spent = await tx.user.updateMany({
        where: { id: input.userId, balance: { gte: count * CREDIT_COST_PER_SOLUTION } },
        data: { balance: { decrement: count * CREDIT_COST_PER_SOLUTION } },
      });
      if (spent.count === 0) {
        throw new SolutionError("У вас закончились решения", "INSUFFICIENT_CREDITS");
      }

      const created = [];
      for (const a of attempts) {
        const row = await tx.solution.create({
          data: {
            userId: input.userId,
            imageUrl,
            subject: a.result.subject,
            recognizedProblem: a.result.recognizedProblem,
            answer: a.result.answer,
            steps: a.result.steps as unknown as Prisma.InputJsonValue,
            explanationMode: input.mode,
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
        where: { id: input.userId },
        select: { balance: true },
      });

      await recordBalanceTx(tx, {
        userId: input.userId,
        type: "solution",
        amount: -count * CREDIT_COST_PER_SOLUTION,
        balanceAfter: balanceAfter?.balance ?? 0,
        // link to the first created solution row (one entry per solve request)
        refId: created[0]?.id,
      });

      return { created, balance: balanceAfter?.balance ?? 0 };
    });

    return {
      solutions: outcome.created.map(toDetail),
      balance: outcome.balance,
      failedTaskNumbers,
    };
  } catch (err) {
    // AI failed — never deduct a credit. Clean up stored image to avoid orphans.
    if (storedKey) {
      await getStorage().delete(storedKey).catch(() => {});
    }
    if (err instanceof SolutionError) throw err;
    if (err instanceof AIProviderError) throw mapProviderError(err);
    throw new SolutionError("AI_ERROR", "AI_ERROR");
  }
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
    steps: Array.isArray(row.steps)
      ? (row.steps as unknown as SolutionDetail["steps"])
      : [],
    explanationMode: row.explanationMode ?? null,
    model: row.model ?? null,
    provider: row.provider ?? null,
  };
}
