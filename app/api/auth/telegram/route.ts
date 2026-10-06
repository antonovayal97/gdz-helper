import { NextResponse } from "next/server";
import { z } from "zod";
import { headers as nextHeaders } from "next/headers";
import { authenticateTelegramUser } from "@/lib/server/auth";
import { handleError } from "@/lib/server/api";
import { rateLimit, getClientKey } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  initData: z.string().max(16_384).optional(),
  dev: z.boolean().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const h = await nextHeaders();
    rateLimit(`auth:${getClientKey(h)}`, { limit: 60, windowMs: 60_000 });

    const parsed = bodySchema.parse(await request.json());
    const { user, token } = await authenticateTelegramUser({
      initData: parsed.initData ?? "",
      dev: parsed.dev,
    });

    return NextResponse.json({ ok: true, token, user });
  } catch (err) {
    return handleError(err);
  }
}
