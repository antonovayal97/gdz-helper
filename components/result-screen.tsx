"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Check,
  Image as ImageIcon,
  RefreshCcw,
  MessageSquareHeart,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Formula } from "@/components/formula";
import { useToast } from "@/components/toast-context";
import { useAuth } from "@/components/auth-context";
import { apiFetch } from "@/lib/client/api";
import { subjectEmoji, subjectLabel, formatDate, formatTime } from "@/components/helpers";
import { bindBackButton } from "@/lib/client/telegram";
import type { SolutionDetail } from "@/types";

export function ResultScreen({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [solution, setSolution] = useState<SolutionDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState<"answer" | "solution" | null>(null);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ solution: SolutionDetail }>(`/api/solutions/${id}`)
      .then((res) => setSolution(res.solution))
      .catch(() => setNotFound(true));
  }, [user, id]);

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
    const lines = [solution.answer, "", ...solution.steps.map((s) => `${s.title}: ${s.explanation}`)];
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
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 pt-4">
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
  const grade = solution.grade ? ` · ${solution.grade} класс` : "";

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md animate-fade-in px-5 pb-16 pt-4">
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
            {grade}
          </span>
        </div>
      </div>

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
          {solution.recognizedProblem}
        </p>
      </Card>

      {/* Ответ */}
      <Card className="mt-4 border-accent/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-hint">Ответ</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-2xl font-extrabold leading-snug text-accent">{solution.answer}</p>
          <Button size="sm" variant="secondary" onClick={copyAnswer}>
            {copied === "answer" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            {copied === "answer" ? "Готово" : "Копировать"}
          </Button>
        </div>
      </Card>

      {/* Решение */}
      {steps.length > 0 && (
        <Card className="mt-4 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-hint">Решение</p>
          <ol className="mt-3 space-y-5">
            {steps.map((step, i) => (
              <li key={i} className="relative flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">{step.title}</p>
                  {step.formula ? (
                    <div className="mt-1.5 rounded-xl bg-background px-3 py-2">
                      <Formula text={step.formula} className="text-[15px]" />
                    </div>
                  ) : null}
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {step.explanation}
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
        <button
          onClick={copySolution}
          className="flex items-center gap-1.5 text-sm font-semibold text-accent"
        >
          {copied === "solution" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Скопировать решение
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={goHome} leftIcon={<RefreshCcw className="h-5 w-5" />}>
          Новая задача
        </Button>
        <Button size="lg" onClick={goHome} leftIcon={<MessageSquareHeart className="h-5 w-5" />}>
          Решить ещё
        </Button>
      </div>
    </div>
  );
}
