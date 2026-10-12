"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Gift, Check, Loader2, Receipt, Zap } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-context";
import { useToast } from "@/components/toast-context";
import { apiFetch } from "@/lib/client/api";
import { currencySymbol, formatPrice } from "@/components/helpers";
import { BalanceTxRow } from "@/components/balance-tx-row";
import type { BalanceTransactionDto } from "@/types";

interface ReferralDto {
  code: string;
  link: string;
  referralCount: number;
  totalReward: number;
}

interface TopupCfg {
  creditPrice: number;
  currency: string;
  minCredits: number;
  maxCredits: number;
}

interface CreatePaymentResponse {
  payment: { id: string; amount: number; currency: string };
  mock: boolean;
}

/** How many latest operations are shown before the link to the full history. */
const LAST_TX_PREVIEW = 3;

export function BalanceScreen() {
  const { user, getBalance, refresh } = useAuth();
  const toast = useToast();
  const [topup, setTopup] = useState<TopupCfg | null>(null);
  const [creditsInput, setCreditsInput] = useState("");
  const [referral, setReferral] = useState<ReferralDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<CreatePaymentResponse | null>(null);
  const [transactions, setTransactions] = useState<BalanceTransactionDto[] | null>(null);

  const loadHistory = useCallback(() => {
    apiFetch<{ transactions: BalanceTransactionDto[] }>("/api/balance/history")
      .then((res) => setTransactions(res.transactions))
      .catch(() => setTransactions([]));
  }, []);

  useEffect(() => {
    apiFetch<{ topup: TopupCfg }>("/api/balance")
      .then((res) => setTopup(res.topup))
      .catch(() => setTopup(null));
    apiFetch<{ referral: ReferralDto }>("/api/referral")
      .then((res) => setReferral(res.referral))
      .catch(() => setReferral(null));
    loadHistory();
  }, [loadHistory]);

  const credits = Math.floor(Number(creditsInput)) || 0;
  const withinLimits = topup !== null && credits >= topup.minCredits && credits <= topup.maxCredits;
  const total = topup ? Math.round(credits * topup.creditPrice * 100) / 100 : 0;

  const topUp = useCallback(async () => {
    if (!topup || !withinLimits) {
      toast.error("Некорректное количество ⚡");
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch<CreatePaymentResponse>("/api/payments/create", {
        method: "POST",
        json: { credits },
      });
      setPendingPayment(res);
      toast.info(`Заказ на ${credits} ⚡ создан. Оплати (демо-режим).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось начать оплату");
    } finally {
      setCreating(false);
    }
  }, [topup, withinLimits, credits, toast]);

  const completeMockPayment = useCallback(async () => {
    if (!pendingPayment) return;
    try {
      await apiFetch<{ ok: boolean }>("/api/payments/webhook", {
        method: "POST",
        json: { paymentId: pendingPayment.payment.id, status: "paid" },
      });
      toast.success("Баланс пополнен!");
      setPendingPayment(null);
      await getBalance();
      await refresh();
      loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Оплата не удалась");
    }
  }, [pendingPayment, toast, getBalance, refresh, loadHistory]);

  const copyReferral = useCallback(async () => {
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral.link);
      toast.success("Ссылка скопирована");
    } catch {
      toast.info(referral.link);
    }
  }, [referral, toast]);

  return (
    <div className="animate-fade-in flex flex-col gap-5 px-5 pb-nav pt-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-accent" />
        <h1 className="text-[26px] font-extrabold leading-tight">Баланс</h1>
      </div>

      {/* Balance */}
      <Card className="flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-sm text-hint">Ваш баланс</p>
        <p className="text-5xl font-extrabold tracking-tight">
          {user ? (
            <>
              {user.balance} <span className="relative bottom-1.25 text-[2rem]">⚡</span>
            </>
          ) : (
            "…"
          )}
        </p>
      </Card>

      {/* Custom balance top-up */}
      <div>
        <SectionTitle>Пополнить баланс</SectionTitle>
        <Card className="space-y-4 p-5">
          {topup === null ? (
            <div className="skeleton h-32 w-full" />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="Количество ⚡ для пополнения"
                    placeholder="Сколько ⚡ нужно?"
                    value={creditsInput}
                    onChange={(e) => setCreditsInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 pr-10 text-[15px] font-semibold text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-hint focus:border-link"
                  />
                  <Zap
                    className="pointer-events-none absolute right-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-accent"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-extrabold leading-tight tracking-tight">
                    {total > 0 ? formatPrice(total, topup.currency) : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-hint">
                    {topup.creditPrice} {currencySymbol(topup.currency)} за ⚡
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                loading={creating}
                disabled={creating || !withinLimits}
                onClick={topUp}
              >
                {creating
                  ? "Создаём…"
                  : `Пополнить${total > 0 ? ` за ${formatPrice(total, topup.currency)}` : ""}`}
              </Button>
            </>
          )}
        </Card>
      </div>

      <div>
        <SectionTitle>Последние операции</SectionTitle>
        {transactions === null ? (
          <div className="skeleton h-32 w-full rounded-3xl" />
        ) : transactions.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <Receipt className="h-8 w-8 text-hint" />
            <p className="text-sm text-hint">Операций пока нет</p>
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {transactions.slice(0, LAST_TX_PREVIEW).map((tx) => (
              <BalanceTxRow key={tx.id} tx={tx} />
            ))}
            {transactions.length > LAST_TX_PREVIEW && (
              <Link
                href="/balance/history"
                className="block p-3 text-center text-sm font-semibold text-accent"
              >
                Полная история ({transactions.length})
              </Link>
            )}
          </Card>
        )}
      </div>

      {/* Mock payment note */}
      {pendingPayment && (
        <Card className="flex flex-col items-center gap-3 p-5 text-center">
          <p className="text-sm text-hint">
            Демо-оплата: {pendingPayment.payment.amount} {pendingPayment.payment.currency}
          </p>
          <Button size="lg" className="w-full" onClick={completeMockPayment}>
            <Check className="h-5 w-5" />
            Оплатить (демо)
          </Button>
          <button onClick={() => setPendingPayment(null)} className="text-sm text-hint underline">
            Отмена
          </button>
        </Card>
      )}

      {/* Referral */}
      <div className="mt-2">
        <SectionTitle>Приглашай друзей</SectionTitle>
        <Card className="p-5">
          {referral ? (
            <>
              <div className="flex items-center gap-3">
                <Gift className="h-5 w-5 shrink-0 text-amber-400" />
                <div>
                  <p className="text-[15px] font-semibold">Пригласи друга — получи бонус</p>
                  <p className="text-sm text-hint">Друг получит решение + ты бонус к балансу</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                <code className="min-w-0 flex-1 truncate text-xs text-hint">{referral.link}</code>
                <Button size="sm" variant="secondary" onClick={copyReferral}>
                  <Gift className="mr-1 h-4 w-4" />
                  Копировать
                </Button>
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-hint">Приглашено: {referral.referralCount}</span>
                <span className="text-hint">
                  Бонус: <span className="font-bold text-foreground">{referral.totalReward}</span>
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-hint" />
              <p className="text-sm text-hint">Загружаем реферальную ссылку…</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
