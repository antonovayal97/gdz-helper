"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, Gift, Check, Loader2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-context";
import { useToast } from "@/components/toast-context";
import { apiFetch } from "@/lib/client/api";
import { formatCredits } from "@/components/helpers";
import type { CreditPackageDto } from "@/types";

interface ReferralDto {
  code: string;
  link: string;
  referralCount: number;
  totalReward: number;
}

interface CreatePaymentResponse {
  payment: { id: string; amount: number; currency: string };
  mock: boolean;
}

export function BalanceScreen() {
  const { user, getBalance, refresh } = useAuth();
  const toast = useToast();
  const [packages, setPackages] = useState<CreditPackageDto[] | null>(null);
  const [referral, setReferral] = useState<ReferralDto | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<CreatePaymentResponse | null>(null);

  useEffect(() => {
    apiFetch<{ packages: CreditPackageDto[] }>("/api/packages")
      .then((res) => setPackages(res.packages))
      .catch(() => setPackages([]));
    apiFetch<{ referral: ReferralDto }>("/api/referral")
      .then((res) => setReferral(res.referral))
      .catch(() => setReferral(null));
  }, []);

  const buy = useCallback(
    async (pkg: CreditPackageDto) => {
      setCreating(pkg.id);
      try {
        const res = await apiFetch<CreatePaymentResponse>("/api/payments/create", {
          method: "POST",
          json: { packageId: pkg.id },
        });
        setPendingPayment(res);
        toast.info("Заказ создан. Оплати (демо-режим).");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Не удалось начать оплату");
      } finally {
        setCreating(null);
      }
    },
    [toast],
  );

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Оплата не удалась");
    }
  }, [pendingPayment, toast, getBalance, refresh]);

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
    <div className="animate-fade-in flex flex-col gap-5 px-5 pb-10 pt-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-accent" />
        <h1 className="text-[26px] font-extrabold leading-tight">Баланс</h1>
      </div>

      {/* Balance */}
      <Card className="flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-sm text-hint">Ваш баланс</p>
        <p className="text-5xl font-extrabold tracking-tight">
          {user ? user.balance : "…"}
        </p>
        <p className="text-sm text-hint">{user ? formatCredits(user.balance) : ""}</p>
      </Card>

      {/* Packages */}
      <div>
        <SectionTitle>Пакеты решений</SectionTitle>
        {packages === null ? (
          <div className="space-y-3">
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => {
              const best = pkg.credits >= 100;
              return (
                <Card key={pkg.id} className={`p-4 ${best ? "border-accent" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-bold">
                        {formatCredits(pkg.credits)}
                      </p>
                      <p className="text-sm text-hint">{pkg.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold">
                        {pkg.price} {pkg.currency}
                      </p>
                      <p className="text-xs text-hint">
                        ≈ {(pkg.price / pkg.credits).toFixed(1)} / шт
                      </p>
                    </div>
                  </div>
                  {creating === pkg.id ? (
                    <Button className="mt-3 w-full" loading disabled>
                      Создаём…
                    </Button>
                  ) : (
                    <Button className="mt-3 w-full" onClick={() => buy(pkg)}>
                      + Пополнить
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Mock payment note */}
      {pendingPayment && (
        <Card className="flex flex-col items-center gap-3 p-5 text-center">
          <p className="text-sm text-hint">
            Демо-оплата: {pendingPayment.payment.amount}{" "}
            {pendingPayment.payment.currency}
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
