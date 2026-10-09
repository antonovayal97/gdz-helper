"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, Inbox } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-context";
import {
  subjectEmoji,
  subjectLabel,
  formatDate,
  formatTime,
  truncate,
} from "@/components/helpers";
import { apiFetch } from "@/lib/client/api";
import type { SolutionSummary } from "@/types";

export function HistoryScreen() {
  const { user } = useAuth();
  const [solutions, setSolutions] = useState<SolutionSummary[] | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ solutions: SolutionSummary[] }>("/api/solutions")
      .then((res) => setSolutions(res.solutions))
      .catch(() => setSolutions([]));
  }, [user]);

  // group by date key (day granularity)
  const groups: { label: string; items: SolutionSummary[] }[] = [];
  if (solutions) {
    const map = new Map<string, SolutionSummary[]>();
    for (const s of solutions) {
      const key = new Date(s.createdAt).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    for (const [, items] of map) {
      groups.push({ label: formatDate(items[0].createdAt), items });
    }
  }

  return (
    <div className="animate-fade-in flex flex-col gap-4 px-5 pb-nav pt-6">
      <div className="flex items-center gap-2">
        <History className="h-6 w-6 text-accent" />
        <h1 className="text-[26px] font-extrabold leading-tight">История</h1>
      </div>
      <p className="text-sm text-hint">Твои решённые задачи</p>

      {solutions === null ? (
        <div className="space-y-3">
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-20 w-full" />
        </div>
      ) : solutions.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Inbox className="h-10 w-10 text-hint" />
          <p className="text-[15px] font-semibold">Пока пусто</p>
          <p className="text-sm text-hint">Реши свою первую задачу на главном экране</p>
        </Card>
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <SectionTitle>{g.label}</SectionTitle>
            <div className="space-y-2.5">
              {g.items.map((s) => (
                <Link key={s.id} href={`/result/${s.id}`} className="block">
                  <Card className="flex items-start gap-3 p-4 transition-transform active:scale-[0.98]">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-xl">
                      {subjectEmoji(s.subject)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-semibold leading-tight">
                          {subjectLabel(s.subject)}
                        </p>
                        <span className="shrink-0 text-xs text-hint">{formatTime(s.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-sm text-hint">
                        {truncate(s.recognizedProblem, 80)}
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-accent">{s.answer}</p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
