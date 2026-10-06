"use client";

import Link from "next/link";
import { Camera, ImagePlus, Sparkles, Zap } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { SectionTitle, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  subjectEmoji,
  subjectLabel,
  formatTime,
  truncate,
  formatCredits,
} from "@/components/helpers";
import type { SolutionSummary } from "@/types";

interface HomeStateProps {
  recent: SolutionSummary[] | null;
  onPickCamera: () => void;
  onPickGallery: () => void;
}

export function HomeState({ recent, onPickCamera, onPickGallery }: HomeStateProps) {
  const { user } = useAuth();
  const firstName = user?.firstName || "студент";

  return (
    <div className="animate-fade-in flex flex-col gap-5 px-5 pb-10 pt-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-hint">Привет{firstName ? `, ${firstName}` : ""} 👋</p>
          <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight">Решай задачи</h1>
        </div>
      </div>

      {/* Balance chip */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <Zap className="h-5 w-5 shrink-0 text-amber-400" />
        <p className="text-sm text-hint">
          Осталось:{" "}
          <span className="font-bold text-foreground">
            {user ? formatCredits(user.balance) : "—"}
          </span>
        </p>
        <Link href="/balance" className="ml-auto text-sm font-semibold text-link">
          Пополнить
        </Link>
      </div>

      {/* Primary CTA */}
      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/15 blur-2xl" />
        <div className="relative flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-accent-foreground shadow-lg">
            <Camera className="h-8 w-8" />
          </div>
          <div>
            <p className="text-lg font-bold">Сфотографируй задачу</p>
            <p className="mt-1 text-sm text-hint">Получи решение с объяснением за минуту</p>
          </div>
          <Button size="xl" className="w-full max-w-xs" onClick={onPickCamera}>
            <Camera className="h-5 w-5" />
            Сфотографировать задачу
          </Button>
        </div>
      </Card>

      {/* Secondary: gallery */}
      <Button
        variant="secondary"
        size="lg"
        onClick={onPickGallery}
        leftIcon={<ImagePlus className="h-5 w-5" />}
      >
        Загрузить фото из галереи
      </Button>

      {/* Recent solutions */}
      <div className="mt-2">
        <SectionTitle>Последние решения</SectionTitle>
        {recent === null ? (
          <div className="space-y-3">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        ) : recent.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <Sparkles className="h-6 w-6 text-hint" />
            <p className="text-sm text-hint">Пока нет решений — попробуй свою первую задачу!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {recent.map((s) => (
              <Link key={s.id} href={`/result/${s.id}`} className="block">
                <Card className="flex items-start gap-3 p-4 transition-transform active:scale-[0.98]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-lg">
                    {subjectEmoji(s.subject)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-tight">
                      {subjectLabel(s.subject)}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-hint">
                      {truncate(s.recognizedProblem, 70)}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-accent">{s.answer}</p>
                  </div>
                  <span className="shrink-0 text-xs text-hint">{formatTime(s.createdAt)}</span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
