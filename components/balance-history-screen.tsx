"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-context";
import { apiFetch } from "@/lib/client/api";
import { formatDate } from "@/components/helpers";
import { bindBackButton } from "@/lib/client/telegram";
import { BalanceTxRow } from "@/components/balance-tx-row";
import type { BalanceTransactionDto } from "@/types";

/** Full ledger of balance top-ups and write-offs (grouped by day). */
export function BalanceHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<BalanceTransactionDto[] | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ transactions: BalanceTransactionDto[] }>("/api/balance/history")
      .then((res) => setTransactions(res.transactions))
      .catch(() => setTransactions([]));
  }, [user]);

  // Native Telegram back button — same as the header arrow.
  useEffect(() => bindBackButton(() => router.push("/balance")), [router]);

  const goBack = useCallback(() => router.push("/balance"), [router]);

  const groups: { label: string; items: BalanceTransactionDto[] }[] = [];
  if (transactions) {
    const map = new Map<string, BalanceTransactionDto[]>();
    for (const tx of transactions) {
      const key = new Date(tx.createdAt).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(tx);
      map.set(key, arr);
    }
    for (const [, items] of map) {
      groups.push({ label: formatDate(items[0].createdAt), items });
    }
  }

  return (
    <div className="animate-fade-in flex flex-col gap-4 px-5 pb-nav pt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={goBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground transition-transform active:scale-95"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[26px] font-extrabold leading-tight">История баланса</h1>
      </div>

      {transactions === null ? (
        <div className="space-y-3">
          <div className="skeleton h-28 w-full rounded-3xl" />
          <div className="skeleton h-36 w-full rounded-3xl" />
        </div>
      ) : transactions.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Receipt className="h-10 w-10 text-hint" />
          <p className="text-[15px] font-semibold">Пока пусто</p>
          <p className="text-sm text-hint">Пополни баланс или реши свою первую задачу</p>
        </Card>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.label}>
              <SectionTitle>{g.label}</SectionTitle>
              <Card className="divide-y divide-border">
                {g.items.map((tx) => (
                  <BalanceTxRow key={tx.id} tx={tx} grouped />
                ))}
              </Card>
            </div>
          ))}
          {/* The API returns the latest ledger entries only. */}
          {transactions.length >= 100 && (
            <p className="px-1 text-center text-xs text-hint">
              Показаны последние {transactions.length} операций
            </p>
          )}
        </>
      )}
    </div>
  );
}
