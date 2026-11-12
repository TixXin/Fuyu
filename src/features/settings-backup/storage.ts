import { readString, writeString } from "../../lib/storage.ts";
import { buildBackup, type BackupKey, type SettingsBackup } from "./backup.ts";

export function collectBackup(now = new Date()): SettingsBackup {
  return buildBackup((key) => readString(key), now);
}

export const SETTINGS_FILE_SYNCED_KEY = "fuyu-settings-file-synced";

export function readSettingsFileSynced() {
  return readString(SETTINGS_FILE_SYNCED_KEY);
}

export function saveSettingsFileSynced(fingerprint: string) {
  writeString(SETTINGS_FILE_SYNCED_KEY, fingerprint);
}

export function restoreBackup(keys: Partial<Record<BackupKey, string>>) {
  let written = 0;
  for (const [key, value] of Object.entries(keys)) {
    if (typeof value !== "string") continue;
    const oldValue = readString(key);
    if (!writeString(key, value)) continue;
    written += 1;
    window.dispatchEvent(new StorageEvent("storage", { key, oldValue, newValue: value, storageArea: window.localStorage }));
  }
  return written;
}
