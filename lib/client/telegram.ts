"use client";

/**
 * Thin, defensive wrapper around the @tma.js/sdk so the app also renders
 * in a plain browser (local development) without crashing.
 */
import {
  init as sdkInit,
  isTMA as isTmaLib,
  retrieveRawInitData,
  retrieveLaunchParams,
  themeParams,
  miniApp,
  backButton,
} from "@tma.js/sdk";

let initialized = false;

export interface TelegramEnv {
  /** true when running inside the Telegram Mini App */
  isTMA: boolean;
  /** raw initData payload — sent to the backend for validation */
  initDataRaw: string | null;
  /** start_param from the launch link (e.g. "ref_XYZ") */
  startParam: string | null;
}

export function initTelegram(): TelegramEnv {
  if (!initialized) {
    try {
      sdkInit();
    } catch (err) {
      console.warn("[telegram] SDK init failed (running outside Telegram?)", err);
    }
    initialized = true;
  }

  let isTMA = false;
  try {
    isTMA = isTmaLib();
  } catch {
    isTMA = false;
  }

  let initDataRaw: string | null = null;
  let startParam: string | null = null;
  if (isTMA) {
    try {
      initDataRaw = retrieveRawInitData() ?? null;
      const lp = retrieveLaunchParams() as unknown as Record<string, string>;
      startParam = lp.startParam ?? lp.tgWebAppStartParam ?? null;
    } catch {
      // no launch params available
    }
  }

  return { isTMA, initDataRaw, startParam };
}

/**
 * Bind Telegram theme variables to CSS custom properties (--tg-theme-*).
 * Safe to call outside Telegram — it just leaves the CSS fallbacks in place.
 * Returns an unsubscribe function.
 */
export function bindTelegramTheme(): (() => void) | undefined {
  try {
    if (!isTmaLib()) return undefined;
    themeParams.mount();
    const stop = themeParams.bindCssVars();
    return () => {
      try {
        stop();
      } catch {
        /* ignore */
      }
    };
  } catch (err) {
    console.warn("[telegram] theme binding failed", err);
    return undefined;
  }
}

/** Expand the Mini App to fill the viewport (AFTER the UI is ready). */
export function readyTelegram(): void {
  try {
    if (isTmaLib()) miniApp.ready();
  } catch {
    /* ignore */
  }
}

export function bindBackButton(
  onBack: () => void,
): (() => void) | undefined {
  try {
    if (!isTmaLib()) return undefined;
    backButton.mount();
    backButton.show();
    const offClick = backButton.onClick(onBack);
    return () => {
      try {
        offClick();
        backButton.hide();
      } catch {
        /* ignore */
      }
    };
  } catch {
    return undefined;
  }
}

export { isTmaLib, retrieveLaunchParams };
