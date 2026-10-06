import { randomUUID } from "node:crypto";
import type { CreditPackage } from "@prisma/client";
import { PaymentProvider } from "./provider";

/**
 * MockPaymentProvider — for local development.
 * "Initiates" a payment and returns a fake provider id. Completion happens by
 * POSTing to /api/payments/webhook with the app's own idempotency handling
 * (only enabled when ALLOW_MOCK_PAYMENTS=true, in dev).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async initiatePayment(_input: {
    userId: string;
    paymentId: string;
    package: CreditPackage;
  }): Promise<{ providerPaymentId: string }> {
    return { providerPaymentId: `mock_${randomUUID()}` };
  }

  verifyWebhook(_payload: unknown): boolean {
    // In mock mode nothing to verify; the dev-only webhook endpoint requires
    // ALLOW_MOCK_PAYMENTS=true so this can't be abused in production.
    return true;
  }
}
