import type { AIProviderName } from "@/types";

/**
 * Central application configuration.
 * All mutable/evolving values live here (from env) so business logic
 * never hardcodes prices, models, cost rates, etc.
 */

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: string | undefined, fallback = false): boolean {
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

const isProd = process.env.NODE_ENV === "production";

export const config = {
  env: process.env.NODE_ENV ?? "development",
  isProd,

  app: {
    url: process.env.APP_URL ?? "http://localhost:3000",
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    botUsername: process.env.TELEGRAM_BOT_USERNAME ?? "",
    // initData is considered valid within this many seconds
    initDataExpiresInSeconds: 24 * 60 * 60,
  },

  auth: {
    secret: process.env.AUTH_SECRET ?? "",
    // how long the session token lives
    sessionTtlSeconds: 7 * 24 * 60 * 60,
    // welcome credits granted on first registration
    defaultBalance: num(process.env.DEFAULT_BALANCE, 5),
    // dev-only: allow mock auth when running outside Telegram
    allowMockAuth: bool(process.env.ALLOW_MOCK_AUTH, false) && !isProd,
  },

  ai: {
    provider: (process.env.AI_PROVIDER ?? "mock") as AIProviderName,
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY ?? "",
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    },
    bitcoincom: {
      apiKey: process.env.BITCOINCOM_API_KEY ?? "",
      model: process.env.BITCOINCOM_MODEL ?? "",
    },
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 120_000),
    // max image file size accepted for AI (after client-side optimization)
    maxImageBytes: 8 * 1024 * 1024,
    // max pixels (W*H) we allow through to the AI
    maxImageDimension: 4096,
  },

  storage: {
    provider: (process.env.STORAGE_PROVIDER ?? "local") as "local" | "s3",
    localDir: process.env.STORAGE_LOCAL_DIR ?? "uploads",
    s3: {
      endpoint: process.env.STORAGE_ENDPOINT ?? "",
      accessKey: process.env.STORAGE_ACCESS_KEY ?? "",
      secretKey: process.env.STORAGE_SECRET_KEY ?? "",
      bucket: process.env.STORAGE_BUCKET ?? "",
      region: process.env.STORAGE_REGION ?? "us-east-1",
    },
  },

  payments: {
    provider: (process.env.PAYMENT_PROVIDER ?? "mock") as "mock" | "telegram-stars",
    allowMockPayments: bool(process.env.ALLOW_MOCK_PAYMENTS, false) && !isProd,
  },

  referral: {
    reward: num(process.env.REFERRAL_REWARD, 5),
  },

  rateLimit: {
    enabled: bool(process.env.RATE_LIMIT_ENABLED, true),
  },

  limits: {
    maxUploadBytes: 10 * 1024 * 1024, // hard cap for any uploaded photo
  },
} as const;
