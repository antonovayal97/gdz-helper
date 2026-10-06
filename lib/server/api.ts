import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/types";
import { AuthError } from "./auth";
import { ImageValidationError } from "./image";
import { RateLimitError } from "./rate-limit";
import { SolutionError } from "@/services/solution";
import { PaymentError } from "@/services/payment";
import { ZodError } from "zod";

export function jsonError(
  status: number,
  code: ApiErrorBody["error"]["code"],
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

/**
 * Convert a thrown error into a consistent API error response.
 * Business errors map to friendly HTTP codes + client codes.
 */
export function handleError(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ZodError) {
    return jsonError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Некорректные данные");
  }
  if (err instanceof AuthError) {
    return jsonError(401, "UNAUTHORIZED", err.message);
  }
  if (err instanceof ImageValidationError) {
    return jsonError(
      err.code === "IMAGE_TOO_LARGE" ? 413 : 400,
      err.code,
      err.message,
    );
  }
  if (err instanceof RateLimitError) {
    return jsonError(429, "RATE_LIMITED", "Слишком много запросов. Попробуйте позже.");
  }
  if (err instanceof SolutionError) {
    const map: Record<string, { status: number; code: ApiErrorBody["error"]["code"] }> = {
      INSUFFICIENT_CREDITS: { status: 402, code: "INSUFFICIENT_CREDITS" },
      PROBLEM_NOT_RECOGNIZED: { status: 422, code: "PROBLEM_NOT_RECOGNIZED" },
      AI_TIMEOUT: { status: 504, code: "AI_TIMEOUT" },
      AI_ERROR: { status: 502, code: "AI_ERROR" },
    };
    const mapped = map[err.code] ?? { status: 502, code: "AI_ERROR" as const };
    return jsonError(mapped.status, mapped.code, err.message);
  }
  if (err instanceof PaymentError) {
    const status = err.code === "NOT_FOUND" ? 404 : 400;
    return jsonError(
      status,
      (err.code as ApiErrorBody["error"]["code"]) ?? "PAYMENT_ERROR",
      err.message,
    );
  }
  if (err instanceof Error && err.message === "NOT_FOUND") {
    return jsonError(404, "NOT_FOUND", "Не найдено");
  }

  console.error("[api] Unhandled error:", err);
  return jsonError(500, "INTERNAL", "Внутренняя ошибка сервера.");
}
