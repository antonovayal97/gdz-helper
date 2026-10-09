import { createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import type { IncomingHttpHeaders } from "node:http";
import type { User } from "@prisma/client";
import { config } from "@/config";
import { prisma } from "@/lib/db/prisma";
import { recordBalanceTx } from "@/services/balance";
import type { PublicUser } from "@/types";
import { validateInitData, type TelegramUserData } from "@/lib/telegram/validate";

/** Errors thrown by auth helpers. */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code = "UNAUTHORIZED",
  ) {
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
  const payload = base64UrlEncode(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + exp }),
  );
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

// ─── password hashing (scrypt, no external deps) ─────────────────────────

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELISM = 1; // p

/** Returns a self-describing hash: `scrypt$N$r$p$salt$hash`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password.normalize("NFKC"), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELISM,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (![N, r, p].every((x) => Number.isInteger(x) && x > 0)) return false;

  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const derived = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function toPublicUser(user: {
  id: string;
  telegramId: string | null;
  email: string | null;
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
    email: user.email,
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
}

export async function authenticateTelegramUser(
  input: TelegramAuthInput,
): Promise<{ user: PublicUser; token: string }> {
  if (!input.initData) throw new AuthError("Missing initData", "INVALID_INIT_DATA");
  const tg = validateInitData(input.initData);
  if (!tg.id) throw new AuthError("Missing Telegram user id", "INVALID_INIT_DATA");

  const { user } = await upsertUser(tg);
  const token = createSessionToken(user.id);

  return { user: toPublicUser(user), token };
}

// ─── Email auth entry ──────────────────────────────────────────────────────

export interface EmailAuthInput {
  email: string;
  password: string;
}

export interface EmailRegisterInput extends EmailAuthInput {
  /** optional referral code (with or without the `ref_` prefix) */
  referralCode?: string;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Create an email+password account and return a session. */
export async function registerEmailUser(
  input: EmailRegisterInput,
): Promise<{ user: PublicUser; token: string }> {
  const email = normalizeEmail(input.email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError("Этот email уже зарегистрирован", "EMAIL_ALREADY_USED");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      balance: config.auth.defaultBalance,
      referralCode: generateReferralCode(),
      referredBy: await resolveReferrerByCode(input.referralCode),
    },
  });
  await recordWelcomeBonus(user.id, user.balance);

  return { user: toPublicUser(user), token: createSessionToken(user.id) };
}

/** Validate email+password and return a session. */
export async function authenticateEmailUser(
  input: EmailAuthInput,
): Promise<{ user: PublicUser; token: string }> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    // Same message for both cases — don't leak which emails exist.
    throw new AuthError("Неверный email или пароль", "INVALID_CREDENTIALS");
  }

  return { user: toPublicUser(user), token: createSessionToken(user.id) };
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
  await recordWelcomeBonus(user.id, user.balance);

  return { user };
}

/** Welcome credits granted on account creation land in the ledger too. */
async function recordWelcomeBonus(userId: string, balance: number): Promise<void> {
  if (balance <= 0) return;
  await recordBalanceTx(prisma, {
    userId,
    type: "signup",
    amount: balance,
    balanceAfter: balance,
    description: "Стартовый бонус",
  });
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
  return resolveReferrerByCode(startParam.slice(prefix.length));
}

async function resolveReferrerByCode(code?: string): Promise<string | null> {
  if (!code) return null;
  const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
  return referrer?.id ?? null;
}
