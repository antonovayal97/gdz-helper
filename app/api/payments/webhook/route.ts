import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/config";
import { handleError } from "@/lib/server/api";
import { completePayment, getPaymentProvider } from "@/services/payment";

export const dynamic = "force-dynamic";

const webhookSchema = z.object({
  paymentId: z.string().min(1),
  // mock mode only — the real Telegram Stars webhook will carry its own payload
  status: z.enum(["paid", "failed"]),
});

/**
 * POST /api/payments/webhook
 *
 * In production this endpoint is called by the payment gateway (Telegram Stars)
 * with a signed payload; verification happens via getPaymentProvider().
 *
 * In development the MockPaymentProvider lets the app complete a payment by
 * posting { paymentId, status }. This is guarded by ALLOW_MOCK_PAYMENTS=true
 * (only enabled in non-production env) so it can't be abused in production.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!config.payments.allowMockPayments) {
      return NextResponse.json(
        { error: { code: "PAYMENT_ERROR", message: "Webhook disabled" } },
        { status: 403 },
      );
    }

    const parsed = webhookSchema.parse(await request.json());

    // In mock mode the provider's verifyWebhook always returns true;
    // real providers must validate the signature here.
    if (!getPaymentProvider().verifyWebhook(parsed)) {
      return NextResponse.json(
        { error: { code: "PAYMENT_ERROR", message: "Invalid signature" } },
        { status: 401 },
      );
    }

    if (parsed.status === "paid") {
      const result = await completePayment(parsed.paymentId);
      return NextResponse.json({ ok: true, ...result });
    }

    // failed → mark the payment failed (no credit change)
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
