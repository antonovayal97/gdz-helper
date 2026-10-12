import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/config";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { rateLimit } from "@/lib/server/rate-limit";
import { withInflightSlot } from "@/lib/server/inflight";
import { validateImage } from "@/lib/server/image";
import { detectProblemNumbers } from "@/services/solution";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  image: z.string().min(1, "Изображение обязательно"),
});

/**
 * POST /api/solutions/detect — detect task numbers visible on a photo.
 * Best-effort and free (no credit charged). The client uses the result to ask
 * the user which task to solve when several numbers are found.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    rateLimit(`detect:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });

    const parsed = bodySchema.parse(await request.json());
    const image = validateImage(parsed.image);

    // Global in-flight cap: detection shares the provider's RPS budget with
    // the solve queue. Over the cap we fail fast (429) — the client degrades
    // to solving the whole photo.
    const numbers = await withInflightSlot(
      "detect:global",
      config.jobs.detectConcurrency,
      () =>
        detectProblemNumbers({
          imageData: image.data,
          mimeType: image.mimeType,
        }),
    );

    return NextResponse.json({ ok: true, numbers });
  } catch (err) {
    return handleError(err);
  }
}
