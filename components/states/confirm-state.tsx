"use client";

import { RefreshCw, Trash2, Scan, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EXPLANATION_MODES, type ExplanationMode } from "@/types";
import { formatCredits } from "@/components/helpers";

interface ConfirmStateProps {
  photo: { dataUrl: string; mimeType: string; width: number; height: number };
  mode: ExplanationMode;
  onModeChange: (mode: ExplanationMode) => void;
  onSolve: () => void;
  onRetake: () => void;
  onRemove: () => void;
  solving: boolean;
  balance: number | null;
}

export function ConfirmState({
  photo,
  mode,
  onModeChange,
  onSolve,
  onRetake,
  onRemove,
  solving,
  balance,
}: ConfirmStateProps) {
  // Strokes per mode for a nicer radio row.
  const desc: Record<ExplanationMode, string> = {
    answer: "только результат",
    "step-by-step": "подробное решение",
    schoolboy: "максимально просто",
    parent: "как объяснить ребёнку самому",
  };

  const hasCredits = balance == null || balance > 0;

  return (
    <div className="animate-fade-in flex flex-col gap-5 px-5 pb-10 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold">Новая задача</h1>
        <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-hint">
          <Zap className="mr-1 inline h-3.5 w-3.5 text-amber-400" />
          {formatCredits(1)}
        </span>
      </div>

      {/* Photo preview */}
      <Card className="relative overflow-hidden p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.dataUrl}
          alt="Задача"
          className="h-auto max-h-[320px] w-full rounded-2xl object-contain"
        />
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={onRetake} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Заново
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove} leftIcon={<Trash2 className="h-4 w-4" />}>
            Удалить
          </Button>
        </div>
      </Card>

      {/* Subject (auto-detected by AI) */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <Scan className="h-5 w-5 shrink-0 text-hint" />
        <div>
          <p className="text-[15px] font-semibold">Предмет</p>
          <p className="text-sm text-hint">Определится автоматически</p>
        </div>
      </div>

      {/* Explanation mode */}
      <div>
        <p className="mb-2 px-1 text-sm font-semibold text-hint">Режим объяснения</p>
        <div className="space-y-2">
          {EXPLANATION_MODES.map((m) => {
            const active = mode === m.value;
            return (
              <button
                key={m.value}
                onClick={() => onModeChange(m.value)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                  active
                    ? "border-accent bg-accent/10"
                    : "border-border bg-card hover:bg-card/70"
                }`}
              >
                <div>
                  <p className="text-[15px] font-semibold">{m.label}</p>
                  <p className="text-[13px] text-hint">{desc[m.value]}</p>
                </div>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    active ? "border-accent" : "border-hint/50"
                  }`}
                >
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Solve */}
      <Button size="xl" className="mt-1 w-full" onClick={onSolve} loading={solving} disabled={!hasCredits}>
        {hasCredits ? "Решить задачу" : "У вас закончились решения"}
      </Button>
      <p className="text-center text-[13px] text-hint">Стоимость — {formatCredits(1)} со счёта</p>
    </div>
  );
}
