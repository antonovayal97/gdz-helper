import { validate, parse } from "@tma.js/init-data-node";
import { config } from "@/config";

export interface TelegramUserData {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  startParam?: string;
}

export class InvalidInitDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInitDataError";
  }
}

/**
 * Validates Telegram Mini App initData server-side (HMAC signature + expiry).
 * Never trust the user id coming from the frontend — always go through here.
 *
 * Returns the parsed Telegram user, or throws InvalidInitDataError.
 */
export function validateInitData(initDataRaw: string): TelegramUserData {
  const botToken = config.telegram.botToken;

  if (!botToken) {
    // In dev with a mocked token we still want the pipeline to work, but in
    // production an empty token must never happen.
    if (config.isProd) {
      throw new InvalidInitDataError("Telegram bot token is not configured");
    }
    // No token → skip cryptographical validation in local development ONLY.
    console.warn("[telegram] TELEGRAM_BOT_TOKEN missing — skipping initData signature check (dev)");
  } else {
    try {
      validate(initDataRaw, botToken, { expiresIn: config.telegram.initDataExpiresInSeconds });
    } catch {
      throw new InvalidInitDataError("initData validation failed");
    }
  }

  let data;
  try {
    data = parse(initDataRaw);
  } catch {
    throw new InvalidInitDataError("initData could not be parsed");
  }

  if (!data.user) {
    throw new InvalidInitDataError("No user in initData");
  }

  return {
    id: data.user.id,
    username: data.user.username,
    firstName: data.user.first_name,
    lastName: data.user.last_name,
    photoUrl: data.user.photo_url,
    startParam: data.start_param,
  };
}
