import { renamedKey } from "../../lib/renamedKeys.ts";

export const BACKUP_KEYS = [
  "fuyu-settings",
  "fuyu-setting-presets",
  "fuyu-locale",
  "fuyu-translation-settings",
  "fuyu-music-sources",
  "fuyu-qq-notifications-enabled",
  "fuyu-wechat-reminders-enabled",
  "fuyu-wechat-expose-ui",
  "fuyu-wechat-hide-taskbar-button",
  "fuyu-qq-mail-settings",
  "fuyu-qq-mail-remote-images",
  "fuyu-collapsed-items",
  "fuyu-plugin-pages",
  "fuyu-plugin-market-favorites",
  "fuyu-screenshot-annotation",
  "fuyu-screenshot-settings",
  "fuyu-save-directory",
  "fuyu-update-channel",
  "fuyu-update-preferences",
  "fuyu-agent-sounds",
  "fuyu-agent-session-filters",
  "fuyu-agent-approval",
  "fuyu-agent-push",
  "fuyu-lyrics-offsets",
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

const APP_NAMES = ["fuyu", "fly-island"];

export type SettingsBackup = {
  app: "fuyu";
  version: 1;
  exportedAt: string;
  keys: Partial<Record<BackupKey, string>>;
};

export type BackupProblem = "notJson" | "notBackup" | "newerVersion" | "empty";

export function isBackupKey(key: string): key is BackupKey {
  return (BACKUP_KEYS as readonly string[]).includes(key);
}

export function buildBackup(read: (key: BackupKey) => string | null, now: Date): SettingsBackup {
  const keys: SettingsBackup["keys"] = {};
  for (const key of BACKUP_KEYS) {
    const value = read(key);
    if (value !== null) keys[key] = value;
  }
  return { app: "fuyu", version: 1, exportedAt: now.toISOString(), keys };
}

export function backupFileName(now: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `fuyu-settings-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

export function parseBackup(text: string): { keys: Partial<Record<BackupKey, string>> } | { problem: BackupProblem } {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return { problem: "notJson" };
  }
  if (typeof value !== "object" || value === null) return { problem: "notBackup" };
  const backup = value as Record<string, unknown>;
  if (typeof backup.app !== "string" || !APP_NAMES.includes(backup.app) || typeof backup.keys !== "object" || backup.keys === null) {
    return { problem: "notBackup" };
  }
  if (typeof backup.version !== "number" || backup.version > 1) return { problem: "newerVersion" };
  const keys: Partial<Record<BackupKey, string>> = {};
  for (const [stored, value] of Object.entries(backup.keys)) {
    const key = renamedKey(stored) ?? stored;
    if (isBackupKey(key) && typeof value === "string" && !(key in keys && stored !== key)) keys[key] = value;
  }
  return Object.keys(keys).length > 0 ? { keys } : { problem: "empty" };
}
