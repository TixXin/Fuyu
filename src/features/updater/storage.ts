import { readJson, readString, writeJson, writeString } from "../../lib/storage.ts";

export type UpdateChannel = "stable" | "beta";

export const CHANNEL_KEY = "focusd-island-update-channel";
export const UPDATE_PREFERENCES_KEY = "focusd-island-update-preferences";

/** A pre-release version such as 0.3.1-beta.1. */
export function isPrerelease(version: string) {
  return /^\d+\.\d+\.\d+-/.test(version);
}

/**
 * The channel the user picked. Without a choice, a pre-release build stays on
 * the beta channel (someone installed it on purpose) and every other build is
 * on stable, so nobody gets a beta without asking for one.
 */
export function normalizeUpdateChannel(stored: unknown, version: string): UpdateChannel {
  if (stored === "stable" || stored === "beta") return stored;
  return isPrerelease(version) ? "beta" : "stable";
}

export function loadUpdateChannel(version: string): UpdateChannel {
  return normalizeUpdateChannel(readString(CHANNEL_KEY), version);
}

export function saveUpdateChannel(channel: UpdateChannel) {
  writeString(CHANNEL_KEY, channel);
}

export const CHECK_INTERVAL_HOURS = [1, 6, 12, 24] as const;
export type CheckIntervalHours = (typeof CHECK_INTERVAL_HOURS)[number];
export type UpdateReminderMode = "badge" | "notification";
/** "download": fetch new versions in the background; "install": and install them when idle (D18). */
export type AutoUpdateMode = "off" | "download" | "install";

export function normalizeCheckInterval(value: unknown): CheckIntervalHours {
  return CHECK_INTERVAL_HOURS.find((hours) => hours === value) ?? 1;
}

export type UpdatePreferences = {
  autoCheck: boolean;
  checkIntervalHours: CheckIntervalHours;
  reminderMode: UpdateReminderMode;
  autoUpdate: AutoUpdateMode;
  notificationUnavailable: boolean;
  /** channel:version, so reopening the app does not repeat a system notification. */
  lastNotifiedKey: string | null;
  skippedVersion: string | null;
  /** Last successful check, retained across app restarts. */
  lastCheckedAt: number | null;
};

export const DEFAULT_UPDATE_PREFERENCES: UpdatePreferences = {
  autoCheck: true,
  checkIntervalHours: 1,
  reminderMode: "badge",
  autoUpdate: "download",
  notificationUnavailable: false,
  lastNotifiedKey: null,
  skippedVersion: null,
  lastCheckedAt: null,
};

export function normalizeUpdatePreferences(stored: unknown): UpdatePreferences {
  if (typeof stored !== "object" || stored === null) return { ...DEFAULT_UPDATE_PREFERENCES };
  const value = stored as Record<string, unknown>;
  return {
    autoCheck: value.autoCheck !== false,
    checkIntervalHours: normalizeCheckInterval(value.checkIntervalHours),
    reminderMode: value.reminderMode === "notification" ? "notification" : "badge",
    autoUpdate: value.autoUpdate === "off" || value.autoUpdate === "install" ? value.autoUpdate : "download",
    notificationUnavailable: value.notificationUnavailable === true,
    lastNotifiedKey: typeof value.lastNotifiedKey === "string" ? value.lastNotifiedKey : null,
    skippedVersion: typeof value.skippedVersion === "string" && value.skippedVersion ? value.skippedVersion : null,
    lastCheckedAt: typeof value.lastCheckedAt === "number" && Number.isFinite(value.lastCheckedAt) && value.lastCheckedAt >= 0 && value.lastCheckedAt <= Date.now()
      ? value.lastCheckedAt : null,
  };
}

export function loadUpdatePreferences(): UpdatePreferences {
  return normalizeUpdatePreferences(readJson(UPDATE_PREFERENCES_KEY));
}

export function saveUpdatePreferences(patch: Partial<UpdatePreferences>): UpdatePreferences {
  const next = { ...loadUpdatePreferences(), ...patch };
  writeJson(UPDATE_PREFERENCES_KEY, next);
  return next;
}
