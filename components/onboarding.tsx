"use client";

import { useCallback, useRef, useState } from "react";
import { Brain, Camera, Zap } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";

interface Slide {
  icon: typeof Camera;
  title: string;
  text: string;
}

const SLIDES: Slide[] = [
  {
    icon: Camera,
    title: "Сфотографируй задачу",
    text: "Наведи камеру на учебник или загрузи фото из галереи. ИИ распознает условие и определит предмет.",
  },
  {
    icon: Brain,
    title: "Решение с объяснением",
    text: "Выбери режим: только ответ, пошаговое решение, «объясни как ребёнку» или подробно для родителя.",
  },
  {
    icon: Zap,
    title: "Стартовый бонус уже у тебя",
    text: "Мы начислили бесплатные решения на твой баланс. Сфотографируй первую задачу прямо сейчас!",
  },
];

/**
 * First-run tour for new accounts: three slides explaining the core flow
 * (photo → explanation modes → welcome bonus). Shown by PageShell until
 * completeOnboarding() persists the flag on the server.
 */
export function Onboarding() {
  const { completeOnboarding } = useAuth();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const slide = SLIDES[index]!;
  const isLast = index === SLIDES.length - 1;

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  }, []);

  const finish = useCallback(async () => {
    setSaving(true);
    try {
      await completeOnboarding();
    } catch {
      setSaving(false);
      // On failure the flag stays unset — the tour re-appears on the next visit.
    }
  }, [completeOnboarding]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
      touchStartX.current = null;
      if (dx < -40 && !isLast) next();
      else if (dx > 40) setIndex((i) => Math.max(i - 1, 0));
    },
    [isLast, next],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Top bar: skip */}
      <div className="flex justify-end px-5 pt-4">
        {saving ? null : (
          <button
            onClick={finish}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-hint active:bg-card"
          >
            Пропустить
          </button>
        )}
      </div>

      {/* Slide body */}
      <div
        className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          key={index}
          className="animate-fade-in flex flex-col items-center gap-6"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-[32px] bg-accent text-accent-foreground shadow-lg">
            <slide.icon className="h-12 w-12" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold leading-tight">{slide.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-hint">{slide.text}</p>
          </div>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              aria-label={`Слайд ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-accent" : "w-2 bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-5 pb-10">
        {isLast ? (
          <Button size="xl" className="w-full" onClick={finish} loading={saving}>
            Начать решать
          </Button>
        ) : (
          <Button size="xl" className="w-full" onClick={next}>
            Далее
          </Button>
        )}
      </div>
    </div>
  );
}
