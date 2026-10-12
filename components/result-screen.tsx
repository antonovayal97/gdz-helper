"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Check,
  Cpu,
  Image as ImageIcon,
  MessageSquareHeart,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Formula, MathText } from "@/components/formula";
import { useToast } from "@/components/toast-context";
import { useAuth } from "@/components/auth-context";
import { AuthScreen } from "@/components/auth-screen";
import { apiFetch } from "@/lib/client/api";
import {
  subjectEmoji,
  subjectLabel,
  formatDate,
  formatTime,
  formatUsdCost,
} from "@/components/helpers";
import { bindBackButton } from "@/lib/client/telegram";
import { explanationModeLabel, type SolutionDetail } from "@/types";

interface ResultScreenProps {
  id: string;
  /** All solution ids from one batch-solve (same photo), in task order. */
  batchIds?: string[];
  /** Task labels matching `batchIds` by index, when known (shown as "№ А5"). */
  batchNumbers?: string[];
}

export function ResultScreen({ id, batchIds, batchNumbers }: ResultScreenProps) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const toast = useToast();
  const batch = batchIds && batchIds.length > 1 ? batchIds : null;
  const [activeId, setActiveId] = useState<string>(() =>
    batch ? (batch.includes(id) ? id : batch[0]) : id,
  );
  const [solution, setSolution] = useState<SolutionDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState<"answer" | "solution" | null>(null);
  const [showImage, setShowImage] = useState(false);
  /** True while a tab switch is in flight — loaded content dims until the new task arrives. */
  const [switching, setSwitching] = useState(false);
  const solutionRef = useRef<SolutionDetail | null>(null);

  useEffect(() => {
    if (!user) return;
    if (solutionRef.current?.id === activeId) return; // already loaded
    let ignore = false;
    apiFetch<{ solution: SolutionDetail }>(`/api/solutions/${activeId}`)
      .then((res) => {
        if (ignore) return;
        solutionRef.current = res.solution;
        setSolution(res.solution);
        setSwitching(false);
      })
      .catch(() => {
        if (ignore) return;
        setSwitching(false);
        const prev = solutionRef.current;
        if (prev) {
          // A tab switch failed — keep the loaded task on screen and reselect its tab.
          toast.error("Не удалось загрузить задачу. Попробуй ещё раз.");
          setActiveId(prev.id);
        } else {
          setNotFound(true);
        }
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast.error is a stable useCallback; the wrapping `toast` object is re-created on every provider render and would churn the effect
  }, [user, activeId, toast.error]);

  // Native Telegram back button — same as the header arrow.
  useEffect(() => {
    return bindBackButton(() => {
      router.push("/");
    });
  }, [router]);

  const copyAnswer = useCallback(async () => {
    if (!solution) return;
    try {
      await navigator.clipboard.writeText(solution.answer);
      setCopied("answer");
      toast.success("Ответ скопирован");
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.info(solution.answer);
    }
  }, [solution, toast]);

  const copySolution = useCallback(async () => {
    if (!solution) return;
    const lines = [
      solution.answer,
      "",
      ...solution.steps.map((s) => `${s.title}: ${s.explanation}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied("solution");
      toast.success("Решение скопировано");
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.info("Не удалось скопировать");
    }
  }, [solution, toast]);

  const goHome = useCallback(() => {
    router.push("/");
  }, [router]);

  // No session (e.g. the link was opened in a plain browser) — show sign-in.
  if (!user && ready) return <AuthScreen />;

  if (notFound) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-lg font-bold">Решение не найдено</p>
        <p className="text-sm text-hint">Возможно, оно было удалено или ты не автор.</p>
        <Button size="lg" onClick={goHome}>
          На главную
        </Button>
      </div>
    );
  }

  if (!solution) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 pt-[calc(1rem+env(safe-area-inset-top,0px)+var(--tg-top-offset,0px))]">
        <div className="flex items-center gap-2">
          <button
            onClick={goHome}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground"
            aria-label="Назад"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="font-bold">Решение</p>
        </div>
        <div className="space-y-3">
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
      </div>
    );
  }

  const steps = Array.isArray(solution.steps) ? solution.steps : [];
  // In "только ответ" mode the user asked for the answer alone — never show the solution.
  const answerOnly = solution.explanationMode === "answer";
  // The explanation mode the user picked when solving. Old records may lack it.
  const mode = explanationModeLabel(solution.explanationMode);

  return (
    // pt/pb include the safe-area insets and the Telegram header offset
    // (--tg-top-offset) because the app runs Telegram in fullscreen mode:
    // the status bar and the home indicator overlap the webview.
    <div className="mx-auto min-h-dvh w-full max-w-md animate-fade-in px-5 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top,0px)+var(--tg-top-offset,0px))]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={goHome}
          className="flex h-10 items-center gap-2 rounded-full bg-card px-3 text-[15px] font-semibold text-foreground transition-transform active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
          Новая задача
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-base">{subjectEmoji(solution.subject)}</span>
          <span className="max-w-[140px] truncate text-sm font-semibold text-hint">
            {subjectLabel(solution.subject)}
          </span>
        </div>
      </div>

      {/* Task switcher — shown when several tasks were solved from one photo */}
      {batch && (
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          {batch.map((sid, i) => {
            const active = sid === activeId;
            const num = batchNumbers?.[i];
            return (
              <button
                key={sid}
                onClick={() => {
                  if (sid === activeId) return;
                  // Keep the loaded task visible (dimmed) while the new one fetches,
                  // then fade the content in — see the keyed wrapper below.
                  setSwitching(true);
                  setActiveId(sid);
                }}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 ${
                  active
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border bg-card text-hint"
                } ${active && switching ? "animate-pulse" : ""}`}
              >
                {num ? `№ ${num}` : `Задача ${i + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Task-dependent content: dims while switching tabs, fades in when the new task arrives */}
      <div
        className={`transition-opacity duration-200 ease-out ${
          switching ? "opacity-40" : "opacity-100"
        }`}
      >
        <div key={solution.id} className="animate-fade-in">
          {/* Explanation mode chosen by the user */}
          {mode && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              <span className="text-sm text-hint">Режим объяснения:</span>
              <span className="ml-auto text-sm font-semibold">{mode}</span>
            </div>
          )}

          {/* Model(s) used and the cost price of the AI request behind this solution */}
          {(solution.model || solution.estimatedCost != null) && (
            <div
              className={`rounded-2xl border border-border bg-card px-4 py-2.5 ${mode ? "mt-2" : "mt-3"}`}
            >
              {solution.model && (
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 shrink-0 text-accent" />
                  <span className="text-sm text-hint">Модель:</span>
                  <span className="ml-auto flex min-w-0 items-baseline justify-end gap-1.5">
                    <span className="truncate text-sm font-semibold" title={solution.model}>
                      {solution.model}
                    </span>
                    {solution.provider && (
                      <span className="shrink-0 text-xs text-hint">{solution.provider}</span>
                    )}
                  </span>
                </div>
              )}
              {solution.estimatedCost != null && (
                <div
                  className={`flex items-center gap-2 ${solution.model ? "mt-2 border-t border-border pt-2" : ""}`}
                >
                  <ReceiptText className="h-4 w-4 shrink-0 text-accent" />
                  <span className="text-sm text-hint">Себестоимость:</span>
                  <span className="ml-auto text-sm font-semibold">
                    {formatUsdCost(solution.estimatedCost)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Photo toggle */}
          <button
            onClick={() => setShowImage((v) => !v)}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left"
          >
            <ImageIcon className="h-5 w-5 shrink-0 text-hint" />
            <span className="flex-1 text-sm font-semibold">Фотография задачи</span>
            <span className="text-xs text-hint">{showImage ? "скрыть" : "показать"}</span>
          </button>
          {showImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={solution.imageUrl}
              alt="Задача"
              className="mt-2 h-auto max-h-[280px] w-full rounded-2xl border border-border object-contain"
            />
          )}

          {/* Условие */}
          <Card className="mt-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-hint">Условие</p>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">
              <MathText text={solution.recognizedProblem} />
            </p>
          </Card>

          {/* Ответ */}
          <Card className="mt-4 border-accent/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-hint">Ответ</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 break-words text-xl font-extrabold leading-snug text-accent">
                <MathText text={solution.answer} />
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={copyAnswer}
                className="shrink-0"
                aria-label="Копировать ответ"
              >
                {copied === "answer" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </Card>

          {/* Решение */}
          {!answerOnly && steps.length > 0 && (
            <Card className="mt-4 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-hint">Решение</p>
              <ol className="mt-3 space-y-5">
                {steps.map((step, i) => (
                  <li key={i} className="relative flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold">
                        <MathText text={step.title} />
                      </p>
                      {step.formula ? (
                        <div className="mt-1.5 rounded-xl bg-background px-3 py-2">
                          <Formula text={step.formula} className="text-[15px]" />
                        </div>
                      ) : null}
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        <MathText text={step.explanation} />
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {/* Meta + actions */}
          <div className="mt-5 flex items-center justify-between">
            <span className="text-xs text-hint">
              {formatDate(solution.createdAt)} · {formatTime(solution.createdAt)}
            </span>
            {!answerOnly && (
              <button
                onClick={copySolution}
                className="flex items-center gap-1.5 text-sm font-semibold text-accent"
              >
                {copied === "solution" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Скопировать решение
              </button>
            )}
          </div>

          <div className="mt-4">
            <Button
              size="lg"
              className="w-full"
              onClick={goHome}
              leftIcon={<MessageSquareHeart className="h-5 w-5" />}
            >
              Решить ещё
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
