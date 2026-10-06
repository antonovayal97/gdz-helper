import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { rateLimit } from "@/lib/server/rate-limit";
import { validateImage } from "@/lib/server/image";
import { createSolution, listSolutions } from "@/services/solution";
import { EXPLANATION_MODES, type ExplanationMode } from "@/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  image: z.string().min(1, "Изображение обязательно"),
  mode: z
    .enum(EXPLANATION_MODES.map((m) => m.value) as [string, ...string[]])
    .default("step-by-step"),
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

/** POST /api/solutions — solve a problem from a photo. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    rateLimit(`solve:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });

    const parsed = bodySchema.parse(await request.json());
    const image = validateImage(parsed.image);

    const { solution, balance } = await createSolution({
      userId: user.id,
      imageData: image.data,
      mimeType: image.mimeType,
      mode: parsed.mode as ExplanationMode,
    });

    return NextResponse.json({ ok: true, solution, balance });
  } catch (err) {
    return handleError(err);
  }
}
