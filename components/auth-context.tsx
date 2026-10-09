"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { PublicUser } from "@/types";
import { initTelegram, bindTelegramTheme, readyTelegram } from "@/lib/client/telegram";
import {
  apiFetch,
  getToken,
  setToken,
  setCachedUser,
  getCachedUser,
  clearToken,
} from "@/lib/client/api";

interface AuthContextValue {
  user: PublicUser | null;
  /** true once the initial auth attempt has finished */
  ready: boolean;
  /** true when running inside Telegram */
  isTMA: boolean;
  /** urlencoded initData sent to the backend */
  initDataRaw: string | null;
  refresh: () => Promise<void>;
  /** Telegram Mini App login (validates initData). */
  login: () => Promise<void>;
  /** Email + password login. */
  loginEmail: (email: string, password: string) => Promise<void>;
  /** Email + password registration. */
  registerEmail: (email: string, password: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
  getBalance: () => Promise<number>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);
  const [isTMA, setIsTMA] = useState(false);
  const [initDataRaw, setInitDataRaw] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const login = useCallback(async () => {
    const env = initTelegram();
    setIsTMA(env.isTMA);
    setInitDataRaw(env.initDataRaw);
    bindTelegramTheme();

    // If we already have a token, try to refresh the profile; otherwise authenticate.
    const existing = getToken();
    if (existing) {
      try {
        const res = await apiFetch<{ user: PublicUser }>("/api/me");
        const u = res.user;
        // The session might have been invalidated server-side.
        setUser(u);
        setCachedUser(u);
        readyTelegram();
        return;
      } catch {
        // fall through to login
        clearToken();
      }
    }

    if (!env.initDataRaw) {
      // Outside Telegram without a session: the UI falls back to the
      // email login/register screen (see AuthScreen).
      return;
    }

    const res = await apiFetch<{ token: string; user: PublicUser }>("/api/auth/telegram", {
      method: "POST",
      json: { initData: env.initDataRaw },
    });
    setToken(res.token);
    setUser(res.user);
    setCachedUser(res.user);
    readyTelegram();
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      await login();
      return;
    }
    try {
      const res = await apiFetch<{ user: PublicUser }>("/api/me");
      setUser(res.user);
      setCachedUser(res.user);
    } catch {
      clearToken();
      await login();
    }
  }, [login]);

  const storeSession = useCallback(async (path: string, payload: Record<string, unknown>) => {
    const res = await apiFetch<{ token: string; user: PublicUser }>(path, {
      method: "POST",
      json: payload,
    });
    setToken(res.token);
    setUser(res.user);
    setCachedUser(res.user);
    readyTelegram();
  }, []);

  const loginEmail = useCallback(
    async (email: string, password: string) => {
      await storeSession("/api/auth/login", { email, password });
    },
    [storeSession],
  );

  const registerEmail = useCallback(
    async (email: string, password: string, referralCode?: string) => {
      await storeSession("/api/auth/register", {
        email,
        password,
        ...(referralCode ? { referralCode } : {}),
      });
    },
    [storeSession],
  );

  const logout = useCallback(async () => {
    clearToken();
    setUser(null);
    setReady(true);
  }, []);

  const getBalance = useCallback(async () => {
    if (!getToken()) return 0;
    try {
      const res = await apiFetch<{ balance: number }>("/api/balance");
      setUser((prev) => (prev ? { ...prev, balance: res.balance } : prev));
      return res.balance;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    if (inFlight.current) return;
    inFlight.current = (async () => {
      try {
        // Seed from cache for instant paint, then authenticate properly.
        const cached = getCachedUser();
        if (cached) setUser(cached);
        await login();
      } catch (err) {
        console.error("[auth] login failed", err);
        // In dev, surface the reason; in prod the UI will show a retry.
      } finally {
        setReady(true);
      }
    })();
  }, [login]);

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        isTMA,
        initDataRaw,
        refresh,
        login,
        loginEmail,
        registerEmail,
        logout,
        setUser,
        getBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
