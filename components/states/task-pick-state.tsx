"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Hash, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCredits, formatTasks } from "@/components/helpers";
import { explanationModeLabel, type ExplanationMode } from "@/types";

interface TaskPickStateProps {
  numbers: string[];
  mode: ExplanationMode;
  onModeChange: (mode: ExplanationMode) => void;
  onBack: () => void;
  onSolve: (numbers: string[]) => void;
}



export function TaskPickState({
  numbers,
  mode,
  onModeChange,
  onBack,
  onSolve,
}: TaskPickStateProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (n: string) => {
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const clearAll = () => setSelected([]);

  const cost = useMemo(() => selected.length, [selected]);

  return (
    <div className="animate-fade-in flex flex-col gap-5 px-5 pb-10 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex h-10 items-center gap-2 rounded-full bg-card px-3 text-[15px] font-semibold text-foreground transition-transform active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
          Назад
        </button>
        <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-hint">
          {explanationModeLabel(mode)}
        </span>
      </div>

      {/* Intro */}
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-accent/15 text-accent">
          <Hash className="h-7 w-7" />
        </div>
        <h1 className="mt-3 text-[22px] font-extrabold">На фото несколько задач</h1>
        <p className="mt-1 text-sm text-hint">
          Мы нашли задачи с номерами <span className="font-semibold text-foreground">{numbers.join(", ")}</span>.
          Выбери одну или несколько — за каждую спишется одно решение.
        </p>
      </div>

      {/* Number picker (multi-select) */}
      <div className="grid grid-cols-2 gap-3">
        {numbers.map((n) => {
          const active = selected.includes(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              aria-pressed={active}
              className={`group flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-center transition-all active:scale-[0.97] ${
                active
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card hover:border-accent/50 hover:bg-accent/5"
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-extrabold transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "bg-accent/15 text-accent group-hover:bg-accent group-hover:text-accent-foreground"
                }`}
              >
                {n}
              </span>
              <span
                className={`flex items-center gap-1 text-[13px] font-semibold ${
                  active ? "text-accent" : "text-hint"
                }`}
              >
                {active && <Check className="h-3.5 w-3.5" />}
                Задача
              </span>
            </button>
          );
        })}
      </div>

      {/* Mode picker */}
      <div>
        <p className="mb-2 px-1 text-sm font-semibold text-hint">Режим объяснения</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "step-by-step", label: "Пошагово" },
              { value: "answer", label: "Ответ" },
              { value: "schoolboy", label: "Просто" },
              { value: "parent", label: "Родителям" },
            ] as { value: ExplanationMode; label: string }[]
          ).map((m) => {
            const active = mode === m.value;
            return (
              <button
                key={m.value}
                onClick={() => onModeChange(m.value)}
                className={`flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? "border-accent bg-accent/10 text-foreground" : "border-border bg-card text-hint"
                }`}
              >
                {active && <Check className="h-4 w-4 text-accent" />}
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Solve button — appears only when at least one task is selected */}
      {selected.length > 0 && (
        <div className="mt-1 space-y-2">
          <Button
            size="xl"
            className="w-full"
            onClick={() => {
              onSolve(selected);
            }}
          >
            <Zap className="h-5 w-5" />
            Решить {formatTasks(selected.length)} — {formatCredits(cost)}
          </Button>
          <button
            onClick={clearAll}
            className="w-full text-center text-[13px] font-semibold text-hint"
          >
            Сбросить выбор
          </button>
        </div>
      )}

      {selected.length === 0 && (
        <p className="text-center text-[13px] text-hint">
          Нажми на номер задачи, чтобы выбрать — спишется одно решение за каждую
        </p>
      )}
    </div>
  );
}
