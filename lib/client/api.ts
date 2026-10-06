"use client";

import type { ApiErrorBody, PublicUser } from "@/types";

export const TOKEN_KEY = "gdz_session_token";
export const USER_KEY = "gdz_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getCachedUser(): PublicUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as PublicUser) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: PublicUser): void {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export const isApiError = (e: unknown): e is ApiRequestError => e instanceof ApiRequestError;

/**
 * Thin fetch wrapper that attaches the session token and turns the backend's
 * standardized { error: { code, message } } payloads into ApiRequestError.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    const errBody = body as ApiErrorBody | null;
    const message =
      errBody?.error?.message ?? (res.status === 401 ? "Сессия истекла" : "Что-то пошло не так");
    throw new ApiRequestError(res.status, errBody?.error?.code ?? "INTERNAL", message);
  }

  return body as T;
}
