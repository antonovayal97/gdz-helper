import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { BalanceTransactionDto, BalanceTxType } from "@/types";

/**
 * Append one entry to the balance ledger. Call it inside the SAME transaction
 * as the balance mutation so the ledger can never drift from the balance.
 * Accepts both a PrismaClient and a transaction client.
 */
export async function recordBalanceTx(
  client: Prisma.TransactionClient,
  args: {
    userId: string;
    type: BalanceTxType;
    /** Signed: > 0 — пополнение, < 0 — списание. */
    amount: number;
    balanceAfter: number;
    description?: string;
    refId?: string;
  },
): Promise<void> {
  await client.balanceTransaction.create({
    data: {
      userId: args.userId,
      type: args.type,
      amount: args.amount,
      balanceAfter: args.balanceAfter,
      description: args.description ?? null,
      refId: args.refId ?? null,
    },
  });
}

/** Latest balance operations for the user (newest first). */
export async function listBalanceTransactions(
  userId: string,
  limit = 100,
): Promise<BalanceTransactionDto[]> {
  const rows = await prisma.balanceTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      description: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type as BalanceTxType,
    amount: row.amount,
    balanceAfter: row.balanceAfter,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  }));
}
