import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { User } from "@prisma/client";
import { config } from "@/config";
import { prisma } from "@/lib/db/prisma";
import type { PublicUser } from "@/types";
import { validateInitData, type TelegramUserData } from "@/lib/telegram/validate";

/** Errors thrown by auth helpers. */
export class AuthError extends Error {
  constructor(message: string, public readonly code = "UNAUTHORIZED") {
    super(message);
    this.name = "AuthError";
  }
}

// ─── session tokens (HMAC-signed) ─────────────────────────────────────────

const base64UrlEncode = (s: string) => Buffer.from(s).toString("base64url");
const base64UrlDecode = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function sign(data: string): string {
  return createHmac("sha256", config.auth.secret).update(data).digest("base64url");
}

export function createSessionToken(userId: string, exp = config.auth.sessionTtlSeconds): string {
  const payload = base64UrlEncode(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + exp }));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): { sub: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  let parsed: { sub: string; exp: number };
  try {
    parsed = JSON.parse(base64UrlDecode(payload)) as { sub: string; exp: number };
  } catch {
    return null;
  }
  if (typeof parsed.sub !== "string" || typeof parsed.exp !== "number") return null;
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return { sub: parsed.sub };
}

// ─── request helpers ───────────────────────────────────────────────────────

export function extractBearerToken(headers: IncomingHttpHeaders): string | null {
  const auth = headers["authorization"];
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}

/** Resolve the authenticated user from a request's headers. Throws AuthError if absent. */
export async function getCurrentUser(
  headers: IncomingHttpHeaders,
): Promise<PublicUser & { id: string }> {
  const token = extractBearerToken(headers);
  if (!token) throw new AuthError("Missing session token");

  const payload = verifySessionToken(token);
  if (!payload) throw new AuthError("Invalid or expired session");

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AuthError("User not found");

  return toPublicUser(user);
}

export function toPublicUser(user: {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  balance: number;
  referralCode: string;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    balance: user.balance,
    referralCode: user.referralCode,
    createdAt: user.createdAt.toISOString(),
  };
}

// ─── Telegram auth entry ───────────────────────────────────────────────────

export interface TelegramAuthInput {
  initData: string;
  /** used in development only, when ALLOW_MOCK_AUTH=true */
  dev?: boolean;
}

export async function authenticateTelegramUser(
  input: TelegramAuthInput,
): Promise<{ user: PublicUser; token: string }> {
  let tg: TelegramUserData;

  if (input.dev && config.auth.allowMockAuth) {
    // Deterministic id so local development keeps a single user.
    tg = {
      id: 1_000_000_000_000,
      username: "dev_user",
      firstName: "Dev",
      lastName: "User",
      photoUrl: undefined,
      startParam: undefined,
    };
  } else {
    if (!input.initData) throw new AuthError("Missing initData", "INVALID_INIT_DATA");
    tg = validateInitData(input.initData);
    if (!tg.id) throw new AuthError("Missing Telegram user id", "INVALID_INIT_DATA");
  }

  const { user } = await upsertUser(tg);
  const token = createSessionToken(user.id);

  return { user: toPublicUser(user), token };
}

async function upsertUser(tg: TelegramUserData): Promise<{ user: User }> {
  const existing = await prisma.user.findUnique({ where: { telegramId: String(tg.id) } });
  if (existing) {
    // Keep profile data fresh.
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: tg.username ?? existing.username,
        firstName: tg.firstName ?? existing.firstName,
        lastName: tg.lastName ?? existing.lastName,
        photoUrl: tg.photoUrl ?? existing.photoUrl,
      },
    });
    return { user };
  }

  // Normalize telegramId to a string, but preserve the numeric value inside
  // so mock/dev users remain distinguishable.
  const user = await prisma.user.create({
    data: {
      telegramId: String(tg.id),
      username: tg.username ?? null,
      firstName: tg.firstName ?? null,
      lastName: tg.lastName ?? null,
      photoUrl: tg.photoUrl ?? null,
      balance: config.auth.defaultBalance,
      referralCode: generateReferralCode(),
      referredBy: await resolveReferrer(tg.startParam),
    },
  });

  return { user };
}

function generateReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function resolveReferrer(startParam?: string): Promise<string | null> {
  if (!startParam) return null;
  const prefix = "ref_";
  if (!startParam.startsWith(prefix)) return null;
  const code = startParam.slice(prefix.length);
  const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
  return referrer?.id ?? null;
}
