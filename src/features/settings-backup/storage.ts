import { readString, writeString } from "../../lib/storage.ts";
import { buildBackup, type BackupKey, type SettingsBackup } from "./backup.ts";

/** The current settings as a backup. */
export function collectBackup(now = new Date()): SettingsBackup {
  return buildBackup((key) => readString(key), now);
}

// The fingerprint (settingsFile.ts) of the settings last copied between localStorage and
// settings.json, either way. Not a setting: it stays out of BACKUP_KEYS.
export const SETTINGS_FILE_SYNCED_KEY = "fuyu-settings-file-synced";

export function readSettingsFileSynced() {
  return readString(SETTINGS_FILE_SYNCED_KEY);
}

export function saveSettingsFileSynced(fingerprint: string) {
  writeString(SETTINGS_FILE_SYNCED_KEY, fingerprint);
}

/**
 * Writes restored settings; returns how many keys were written. Other windows hear about each
 * key through `storage` events; this window does not, so the same events are sent here too,
 * and the pages reload what they show instead of saving their old state over it.
 */
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
