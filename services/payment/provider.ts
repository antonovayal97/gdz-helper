/** PaymentProvider — abstraction for payment gateways (Telegram Stars, ...). */
export interface PaymentProvider {
  readonly name: string;

  /**
   * Initiate a payment for the given top-up.
   * Returns an opaque provider transaction id.
   */
  initiatePayment(input: {
    userId: string;
    paymentId: string;
    amount: number;
    currency: string;
    credits: number;
  }): Promise<{ providerPaymentId: string }>;

  /** Verify a provider webhook payload (real gateways do signature checks). */
  verifyWebhook(payload: unknown): boolean;
}

export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
