import { NextResponse } from "next/server";
import { z } from "zod";
import { headers as nextHeaders } from "next/headers";
import { authenticateEmailUser } from "@/lib/server/auth";
import { handleError } from "@/lib/server/api";
import { rateLimit, getClientKey } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.email("Укажите корректный email").max(254),
  password: z.string().min(1).max(128),
});

/** POST /api/auth/login — authenticate with email + password. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const h = await nextHeaders();
    rateLimit(`auth:login:${getClientKey(h)}`, { limit: 10, windowMs: 60_000 });

    const parsed = bodySchema.parse(await request.json());
    const { user, token } = await authenticateEmailUser(parsed);

    return NextResponse.json({ ok: true, token, user });
  } catch (err) {
    return handleError(err);
  }
}
