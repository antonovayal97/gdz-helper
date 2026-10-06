"use client";

import { SUBJECT_EMOJI, SUBJECT_LABELS } from "@/types";

export function subjectEmoji(subject: string): string {
  return SUBJECT_EMOJI[subject] ?? SUBJECT_EMOJI.other;
}

export function subjectLabel(subject: string): string {
  return SUBJECT_LABELS[subject] ?? "Задача";
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (startDay === startToday) return "Сегодня";
  const yesterday = startToday - 24 * 60 * 60 * 1000;
  if (startDay === yesterday) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function truncate(text: string, max = 90): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

export function formatCredits(n: number): string {
  const plural = (i: number, forms: [string, string, string]) => {
    const abs = Math.abs(i) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  };
  return `${n} ${plural(n, ["решение", "решения", "решений"])}`;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
