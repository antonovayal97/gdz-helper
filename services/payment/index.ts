import type { CreditPackage } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { config } from "@/config";
import { PaymentProvider } from "./provider";
import { MockPaymentProvider } from "./mock";

export class PaymentError extends Error {
  constructor(message: string, public readonly code = "PAYMENT_ERROR") {
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

export async function listActivePackages(): Promise<CreditPackage[]> {
  return prisma.creditPackage.findMany({
    where: { active: true },
    orderBy: { credits: "asc" },
  });
}

/**
 * Create a pending Payment for a package.
 * IMPORTANT: amount/prices are read from the DATABASE (CreditPackage),
 * never taken from the frontend request.
 */
export async function createPayment(userId: string, packageId: string): Promise<CreatedPayment> {
  const pkg = await prisma.creditPackage.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active) {
    throw new PaymentError("Пакет не найден", "NOT_FOUND");
  }

  const payment = await prisma.payment.create({
    data: {
      userId,
      packageId: pkg.id,
      amount: pkg.price,
      currency: pkg.currency,
      status: "pending",
    },
  });

  const { providerPaymentId } = await getPaymentProvider().initiatePayment({
    userId,
    paymentId: payment.id,
    package: pkg,
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

    const pkg = await tx.creditPackage.findUnique({ where: { id: payment.packageId } });
    if (!pkg) throw new PaymentError("Пакет не найден", "NOT_FOUND");

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "paid" },
    });

    await tx.user.update({
      where: { id: payment.userId },
      data: { balance: { increment: pkg.credits } },
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
        await tx.user.update({
          where: { id: user.referredBy },
          data: { balance: { increment: config.referral.reward } },
        });
      }
    }

    return { credits: pkg.credits };
  });
}
