"use client";

import { useAuth } from "@/components/auth-context";
import { AuthScreen } from "@/components/auth-screen";
import { Onboarding } from "@/components/onboarding";
import { BottomNav } from "@/components/navigation";

/**
 * Shared client wrapper for tab pages: renders children above the bottom nav,
 * shows a lightweight splash while authentication is in progress, and an
 * email/Telegram sign-in screen when there is no active session.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-3xl bg-accent/80 text-2xl">
          📚
        </div>
        <p className="text-sm text-hint">Загружаем…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // First-run tour for brand-new accounts (email or Telegram).
  if (!user.onboarded) {
    return <Onboarding />;
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md">
      {children}
      <BottomNav />
    </div>
  );
}
