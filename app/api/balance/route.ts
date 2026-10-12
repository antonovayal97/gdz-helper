import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { getBalance } from "@/services/user";
import { config } from "@/config";

export const dynamic = "force-dynamic";

/** GET /api/balance — current user balance + custom top-up pricing. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const { balance } = await getBalance(user.id);
    return NextResponse.json({
      ok: true,
      balance,
      topup: {
        creditPrice: config.payments.creditPrice,
        currency: config.payments.currency,
        minCredits: config.payments.minTopupCredits,
        maxCredits: config.payments.maxTopupCredits,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
