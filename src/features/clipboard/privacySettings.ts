import type { ClipboardPrivacySettings } from "./api";

export const CLIPBOARD_SECRET_EXPIRY_MINUTES = [0, 10, 60, 24 * 60, 7 * 24 * 60] as const;

export const CLIPBOARD_TEXT_LIMITS_KB = [256, 1024, 4096, 0] as const;

export const DEFAULT_CLIPBOARD_PRIVACY: ClipboardPrivacySettings = {
  forgetCleared: true,
  secretExpiryMinutes: 0,
  maxTextKb: 1024,
};

const oneOf = (choices: readonly number[], value: unknown, fallback: number) =>
  typeof value === "number" && choices.includes(value) ? value : fallback;

export function normalizeClipboardPrivacy(settings: Partial<ClipboardPrivacySettings>): ClipboardPrivacySettings {
  return {
    forgetCleared: settings.forgetCleared !== false,
    secretExpiryMinutes: oneOf(CLIPBOARD_SECRET_EXPIRY_MINUTES, settings.secretExpiryMinutes, DEFAULT_CLIPBOARD_PRIVACY.secretExpiryMinutes),
    maxTextKb: oneOf(CLIPBOARD_TEXT_LIMITS_KB, settings.maxTextKb, DEFAULT_CLIPBOARD_PRIVACY.maxTextKb),
  };
}
