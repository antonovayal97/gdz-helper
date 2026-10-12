import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { rateLimit } from "@/lib/server/rate-limit";
import { validateImage } from "@/lib/server/image";
import { normalizeTaskLabel } from "@/lib/ai/schema";
import { createSolutionJob, listSolutions } from "@/services/solution";
import { EXPLANATION_MODES, type ExplanationMode } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Only canonical task labels are accepted ("501", "9.15", "А5", "№ 15").
 * This is also the prompt-injection guard: `taskNumbers` is interpolated into
 * the AI user prompt, so arbitrary text must never get through.
 */
const taskNumberSchema = z
  .string()
  .trim()
  .min(1, "Пустой номер задачи")
  .max(16)
  .refine((s) => normalizeTaskLabel(s) !== null, {
    message: "Некорректный номер задачи. Допустимы только обозначения вида «501», «9.15», «А5».",
  })
  // Canonical form ("№ 15" → "15") — only digits/dots/letters reach the prompt.
  .transform((s) => normalizeTaskLabel(s) ?? s);

const bodySchema = z.object({
  image: z.string().min(1, "Изображение обязательно"),
  mode: z
    .enum(EXPLANATION_MODES.map((m) => m.value) as [string, ...string[]])
    .default("step-by-step"),
  taskNumbers: z.array(taskNumberSchema).max(10).nullish(),
});

/** GET /api/solutions — list the current user's solutions. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const solutions = await listSolutions(user.id, 50);
    return NextResponse.json({ ok: true, solutions });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/solutions — enqueue a solve request, return jobId to poll. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    rateLimit(`solve:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });

    const parsed = bodySchema.parse(await request.json());
    const image = validateImage(parsed.image);

    const { jobId } = await createSolutionJob({
      userId: user.id,
      imageData: image.data,
      mimeType: image.mimeType,
      mode: parsed.mode as ExplanationMode,
      taskNumbers: parsed.taskNumbers ?? null,
    });

    return NextResponse.json({ ok: true, jobId, status: "queued" });
  } catch (err) {
    return handleError(err);
  }
}
