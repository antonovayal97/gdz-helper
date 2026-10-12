import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { rateLimit } from "@/lib/server/rate-limit";
import { createPayment } from "@/services/payment";
import { config } from "@/config";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  credits: z.number().int().min(1),
});

/** POST /api/payments/create — create a pending payment for a balance top-up. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    rateLimit(`paycreate:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });

    const parsed = bodySchema.parse(await request.json());
    const payment = await createPayment(user.id, parsed.credits);

    return NextResponse.json({
      ok: true,
      payment,
      mock: config.payments.allowMockPayments,
    });
  } catch (err) {
    return handleError(err);
  }
}
