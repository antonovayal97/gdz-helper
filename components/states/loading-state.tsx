"use client";

import { useEffect, useState } from "react";
import { Camera, ScanText, BookOpen, Brain, CheckCircle2, Clock } from "lucide-react";

const STAGES = [
  { label: "Анализируем фотографию", icon: Camera },
  { label: "Распознаём условие…", icon: ScanText },
  { label: "Определяем предмет…", icon: BookOpen },
  { label: "Решаем задачу…", icon: Brain },
  { label: "Проверяем ответ…", icon: CheckCircle2 },
];

const STAGE_MS = 1600;

/** Position/size of the live solve queue for the current job (from polling). */
export interface QueueInfo {
  /** 1-based position while the job is "queued"; null once it is being processed. */
  position: number | null;
  /** Total live jobs (queued + processing), including ours. */
  size: number;
}

/** "1 задача впереди" / "2 задачи впереди" / "5 задач впереди". */
function tasksAhead(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} задача впереди`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} задачи впереди`;
  return `${n} задач впереди`;
}

export function LoadingState({ queue }: { queue?: QueueInfo | null }) {
  const [stage, setStage] = useState(0);
  // While the job waits behind others we don't pretend to be solving it yet.
  const waiting = queue != null && queue.position != null && queue.position > 1;

  useEffect(() => {
    if (waiting) return;
    const timer = window.setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, STAGE_MS);
    return () => window.clearInterval(timer);
  }, [waiting]);

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

      {/* Live queue position (only when there is an actual queue ahead) */}
      {queue != null && queue.position != null && (
        <div className="w-full max-w-xs animate-fade-in rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-left">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent">
            <Clock className="h-4 w-4 animate-pulse" />
            {queue.position === 1
              ? "Вы первые в очереди — сейчас начнём"
              : `Очередь: вы ${queue.position} из ${queue.size}`}
          </p>
          {queue.position > 1 && (
            <p className="mt-1 pl-6 text-xs text-hint">{tasksAhead(queue.position - 1)}</p>
          )}
        </div>
      )}

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
