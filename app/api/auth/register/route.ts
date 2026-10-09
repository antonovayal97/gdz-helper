import { NextResponse } from "next/server";
import { z } from "zod";
import { headers as nextHeaders } from "next/headers";
import { registerEmailUser } from "@/lib/server/auth";
import { handleError } from "@/lib/server/api";
import { rateLimit, getClientKey } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.email("Укажите корректный email").max(254),
  password: z.string().min(8, "Минимум 8 символов").max(128),
  referralCode: z.string().max(64).optional(),
});

/** POST /api/auth/register — create an account with email + password. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const h = await nextHeaders();
    rateLimit(`auth:register:${getClientKey(h)}`, { limit: 10, windowMs: 60_000 });

    const parsed = bodySchema.parse(await request.json());
    const { user, token } = await registerEmailUser(parsed);

    return NextResponse.json({ ok: true, token, user });
  } catch (err) {
    return handleError(err);
  }
}
