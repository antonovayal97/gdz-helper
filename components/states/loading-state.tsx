"use client";

import { useEffect, useState } from "react";
import { Camera, ScanText, BookOpen, Brain, CheckCircle2 } from "lucide-react";

const STAGES = [
  { label: "Анализируем фотографию", icon: Camera },
  { label: "Распознаём условие…", icon: ScanText },
  { label: "Определяем предмет…", icon: BookOpen },
  { label: "Решаем задачу…", icon: Brain },
  { label: "Проверяем ответ…", icon: CheckCircle2 },
];

const STAGE_MS = 1600;

export function LoadingState() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, STAGE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const progress = Math.min(96, Math.round(((stage + 0.5) / STAGES.length) * 100));

  return (
    <div className="animate-fade-in flex flex-col items-center gap-6 px-5 pb-10 pt-14 text-center">
      {/* Pulsing camera on a shimmering card to fake "scanning" */}
      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-accent shadow-2xl">
          <Camera className="h-12 w-12 animate-pulse text-accent-foreground" />
        </div>
        <div className="absolute -inset-3 -z-10 animate-pulse rounded-[36px] bg-accent/20 blur-xl" />
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-2 overflow-hidden rounded-full bg-card">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-medium text-hint">{progress}%</p>
      </div>

      {/* Stages */}
      <div className="mt-2 flex w-full max-w-xs flex-col gap-3 text-left">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const done = i < stage;
          const current = i === stage;
          return (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              style={{ opacity: done ? 0.55 : 1 }}
            >
              <Icon
                className={
                  done
                    ? "h-5 w-5 text-green-500"
                    : current
                      ? "h-5 w-5 animate-pulse text-accent"
                      : "h-5 w-5 text-hint"
                }
              />
              <p
                className={`text-[15px] ${
                  done ? "text-hint line-through decoration-1" : "font-semibold"
                }`}
              >
                {s.label}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-hint">Обычно занимает 15–40 секунд. Не закрывай приложение ☝️</p>
    </div>
  );
}
