import { prisma } from "@/lib/db/prisma";
import { config } from "@/config";
import { PaymentProvider } from "./provider";
import { MockPaymentProvider } from "./mock";
import { recordBalanceTx } from "@/services/balance";

export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code = "PAYMENT_ERROR",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  switch (config.payments.provider) {
    case "telegram-stars":
      // TODO: implement Telegram Stars provider when it becomes available.
      provider = new MockPaymentProvider();
      break;
    case "mock":
    default:
      provider = new MockPaymentProvider();
      break;
  }
  return provider;
}

export interface CreatedPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  providerPaymentId: string;
}

/**
 * Create a pending Payment for a custom balance top-up.
 * IMPORTANT: the granted credits and the price are validated/computed on the
 * server (config.payments.creditPrice), never taken from the frontend.
 */
export async function createPayment(userId: string, credits: number): Promise<CreatedPayment> {
  if (
    !Number.isInteger(credits) ||
    credits < config.payments.minTopupCredits ||
    credits > config.payments.maxTopupCredits
  ) {
    throw new PaymentError(
      `Укажите от ${config.payments.minTopupCredits} до ${config.payments.maxTopupCredits} ⚡`,
      "INVALID_AMOUNT",
    );
  }

  const amount = Math.round(credits * config.payments.creditPrice * 100) / 100;

  const payment = await prisma.payment.create({
    data: {
      userId,
      credits,
      amount,
      currency: config.payments.currency,
      status: "pending",
    },
  });

  const { providerPaymentId } = await getPaymentProvider().initiatePayment({
    userId,
    paymentId: payment.id,
    amount,
    currency: config.payments.currency,
    credits,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { telegramPaymentId: providerPaymentId },
  });

  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: "pending",
    providerPaymentId,
  };
}

/**
 * Mark a payment as paid and credit the balance.
 * Idempotent — a second call for the same payment does nothing.
 * Also awards the referrer reward on the referred user's FIRST paid payment.
 */
export async function completePayment(paymentId: string): Promise<{ credits: number }> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new PaymentError("Платёж не найден", "NOT_FOUND");
    if (payment.status === "paid") {
      // already processed — idempotency
      return { credits: 0 };
    }

    // New top-ups store the granted credits on the payment itself; legacy
    // package payments fall back to the linked CreditPackage row.
    let credits = payment.credits;
    if (credits == null) {
      const pkg = payment.packageId
        ? await tx.creditPackage.findUnique({ where: { id: payment.packageId } })
        : null;
      if (!pkg) throw new PaymentError("Платёж некорректен", "INVALID_PAYMENT");
      credits = pkg.credits;
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "paid", credits },
    });

    const credited = await tx.user.update({
      where: { id: payment.userId },
      data: { balance: { increment: credits } },
    });
    await recordBalanceTx(tx, {
      userId: payment.userId,
      type: "payment",
      amount: credits,
      balanceAfter: credited.balance,
      description: `Пополнение баланса: ${credits} ⚡`,
      refId: payment.id,
    });

    // Referral reward: on the user's first successful payment, reward their referrer.
    const user = await tx.user.findUnique({
      where: { id: payment.userId },
      select: { referredBy: true },
    });
    if (user?.referredBy) {
      const referred = await tx.referral.findUnique({
        where: { referredUserId: payment.userId },
      });
      if (!referred) {
        await tx.referral.create({
          data: {
            referrerId: user.referredBy,
            referredUserId: payment.userId,
            reward: config.referral.reward,
          },
        });
        const referrer = await tx.user.update({
          where: { id: user.referredBy },
          data: { balance: { increment: config.referral.reward } },
        });
        await recordBalanceTx(tx, {
          userId: user.referredBy,
          type: "referral",
          amount: config.referral.reward,
          balanceAfter: referrer.balance,
          description: "Бонус за приглашённого друга",
          refId: payment.userId,
        });
      }
    }

    return { credits };
  });
}
