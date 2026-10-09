"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Mail, Lock, Send } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isApiError } from "@/lib/client/api";

type Mode = "login" | "register";

/**
 * Shown when there is no active session:
 * - outside Telegram: email login / registration form;
 * - inside Telegram (auth failed): "retry via Telegram" + email form as fallback.
 */
export function AuthScreen() {
  const { isTMA, login, loginEmail, registerEmail } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Referral code from a web share link (?ref=CODE or ?startapp=ref_CODE).
  const referralCode = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("ref") ?? params.get("startapp") ?? undefined;
    if (!raw) return undefined;
    return raw.startsWith("ref_") ? raw.slice(4) : raw;
  }, []);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        if (mode === "register") {
          await registerEmail(email, password, referralCode);
        } else {
          await loginEmail(email, password);
        }
      } catch (err) {
        setError(
          isApiError(err) ? err.message : "Не удалось выполнить действие. Попробуйте ещё раз.",
        );
        setBusy(false);
      }
      // On success AuthProvider updates the user and the app re-renders.
    },
    [busy, mode, email, password, referralCode, loginEmail, registerEmail],
  );

  const retryTelegram = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login();
    } catch {
      setError("Не удалось войти через Telegram. Попробуйте email.");
    } finally {
      setBusy(false);
    }
  }, [busy, login]);

  const inputCls =
    "w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] text-foreground outline-none transition-colors placeholder:text-hint focus:border-link";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-2xl text-accent-foreground shadow-lg">
            📚
          </div>
          <div>
            <p className="text-lg font-bold">Хелпер</p>
            <p className="mt-1 text-sm text-hint">Решай школьные задачи по фотографии</p>
          </div>
        </div>

        {isTMA && (
          <Button
            size="lg"
            className="w-full"
            onClick={retryTelegram}
            disabled={busy}
            leftIcon={<Send className="h-5 w-5" />}
          >
            Войти через Telegram
          </Button>
        )}

        <Card className="w-full p-5">
          <div className="mb-4 flex rounded-2xl bg-card p-1">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-hint"
                }`}
              >
                {m === "login" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-hint" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                style={{ paddingLeft: "2.75rem" }}
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-hint" />
              <input
                type="password"
                required
                minLength={mode === "register" ? 8 : undefined}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder={mode === "register" ? "Пароль (мин. 8 символов)" : "Пароль"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                style={{ paddingLeft: "2.75rem" }}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" className="mt-1 w-full" loading={busy}>
              {mode === "login" ? "Войти" : "Создать аккаунт"}
            </Button>
          </form>

          {referralCode && mode === "register" && (
            <p className="mt-3 text-center text-xs text-hint">
              Реферальный код <span className="font-semibold">{referralCode}</span> применён
              автоматически
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
