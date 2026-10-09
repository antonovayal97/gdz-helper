"use client";

import { ScanSearch } from "lucide-react";

export function DetectingState() {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-6 px-5 pb-10 pt-14 text-center">
      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-accent shadow-2xl">
          <ScanSearch className="h-12 w-12 animate-pulse text-accent-foreground" />
        </div>
        <div className="absolute -inset-3 -z-10 animate-pulse rounded-[36px] bg-accent/20 blur-xl" />
      </div>

      <p className="text-lg font-bold">Анализируем фотографию</p>
    </div>
  );
}
