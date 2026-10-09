"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatDate, formatTime, truncate } from "@/components/helpers";
import type { BalanceTransactionDto } from "@/types";

/** Human-readable title for each ledger entry kind. */
export const TX_LABELS: Record<BalanceTransactionDto["type"], string> = {
  signup: "Стартовый бонус",
  payment: "Пополнение баланса",
  referral: "Бонус за друга",
  solution: "Списание за решение",
  refund: "Возврат",
};

/**
 * One balance operation row. Used in the "Последние операции" preview card
 * and in the full history page (where `grouped` hides the date, since the
 * list is already grouped by day headers).
 */
export function BalanceTxRow({
  tx,
  grouped = false,
}: {
  tx: BalanceTransactionDto;
  grouped?: boolean;
}) {
  const topUp = tx.amount > 0;
  return (
    <div className="flex items-center gap-3 p-3.5">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          topUp ? "bg-green-500/15 text-green-500" : "bg-destructive/15 text-destructive"
        }`}
      >
        {topUp ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">
          {truncate(tx.description ?? TX_LABELS[tx.type] ?? tx.type, 60)}
        </p>
        <p className="mt-0.5 text-xs text-hint">
          {grouped ? "" : `${formatDate(tx.createdAt)}, `}
          {formatTime(tx.createdAt)} · остаток: {tx.balanceAfter}
        </p>
      </div>
      <p
        className={`shrink-0 text-sm font-extrabold ${topUp ? "text-green-500" : "text-destructive"}`}
      >
        {topUp ? "+" : "−"}
        {Math.abs(tx.amount)}
      </p>
    </div>
  );
}
