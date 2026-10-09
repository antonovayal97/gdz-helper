"use client";

import Link from "next/link";
import { Camera, ImagePlus, Zap } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCredits } from "@/components/helpers";

interface HomeStateProps {
  onPickCamera: () => void;
  onPickGallery: () => void;
}

export function HomeState({ onPickCamera, onPickGallery }: HomeStateProps) {
  const { user } = useAuth();

  return (
    <div className="animate-fade-in flex flex-col gap-5 px-5 pb-10 pt-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight">Решай задачи</h1>
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
    </div>
  );
}
