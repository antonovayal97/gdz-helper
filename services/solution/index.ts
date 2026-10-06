import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import { getStorage } from "@/lib/storage";
import type { SolutionDetail, SolutionSummary, ExplanationMode } from "@/types";

export const CREDIT_COST_PER_SOLUTION = 1;

export class SolutionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INSUFFICIENT_CREDITS"
      | "PROBLEM_NOT_RECOGNIZED"
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
}

/**
 * The full solve pipeline. The credit is deducted ONLY after the AI succeeded,
 * atomically with the solution creation, so:
 *   - an AI error never costs the user a credit,
 *   - double-charging is impossible (atomic balance check + deduct).
 */
export async function createSolution(input: CreateSolutionInput): Promise<{
  solution: SolutionDetail;
  balance: number;
}> {
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
    // 2. Call the AI (it will throw AIProviderError on any failure).
    const { result, usage } = await provider.solveProblem({
      image: { data: input.imageData, mimeType: input.mimeType },
      mode: input.mode,
    });

    // 3. Save solution + deduct credit atomically.
    const outcome = await prisma.$transaction(async (tx) => {
      const spent = await tx.user.updateMany({
        where: { id: input.userId, balance: { gte: CREDIT_COST_PER_SOLUTION } },
        data: { balance: { decrement: CREDIT_COST_PER_SOLUTION } },
      });
      if (spent.count === 0) {
        throw new SolutionError("У вас закончились решения", "INSUFFICIENT_CREDITS");
      }

      const created = await tx.solution.create({
        data: {
          userId: input.userId,
          imageUrl,
          subject: result.subject,
          grade: result.grade,
          recognizedProblem: result.recognizedProblem,
          answer: result.answer,
          steps: result.steps as unknown as Prisma.InputJsonValue,
          explanationMode: input.mode,
          provider: usage.provider,
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCost: usage.estimatedCost,
          latencyMs: usage.latencyMs,
          confidence: result.confidence,
          aiStatus: usage.status,
        },
      });
      const balance = await tx.user.findUnique({
        where: { id: input.userId },
        select: { balance: true },
      });
      return { created, balance: balance?.balance ?? 0 };
    });

    return { solution: toDetail(outcome.created), balance: outcome.balance };
  } catch (err) {
    // AI failed — never deduct a credit. Clean up stored image to avoid orphans.
    if (storedKey) {
      await getStorage().delete(storedKey).catch(() => {});
    }
    if (err instanceof SolutionError) throw err;
    if (err instanceof AIProviderError) {
      if (err.kind === "timeout") {
        throw new SolutionError("AI_TIMEOUT", "AI_TIMEOUT");
      }
      if (err.message === "PROBLEM_NOT_RECOGNIZED") {
        throw new SolutionError(
          "Не удалось распознать задачу. Попробуйте сделать фотографию лучше.",
          "PROBLEM_NOT_RECOGNIZED",
        );
      }
    }
    throw new SolutionError("AI_ERROR", "AI_ERROR");
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
      grade: true,
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
      grade: true,
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
  grade: number | null;
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
    grade: row.grade,
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
