import { readString, writeString } from "../storage.ts";
import {
  buildBackup,
  switchesFromBackup,
  type BackupKey,
  type BuiltinSwitchSnapshot,
  type RestoredSwitches,
  type SettingsBackup,
} from "./backup.ts";

export type { BuiltinSwitchSnapshot, RestoredSwitches };

export type BackupSwitchBridge = {
  snapshot: () => BuiltinSwitchSnapshot | null;
  apply: (restored: RestoredSwitches) => void;
  subscribe?: (listener: () => void) => () => void;
};

let switchBridge: BackupSwitchBridge | null = null;

export function registerBackupSwitches(bridge: BackupSwitchBridge | null) {
  switchBridge = bridge;
}

export function readBackupSwitchSnapshot(): BuiltinSwitchSnapshot | null {
  return switchBridge?.snapshot() ?? null;
}

export function subscribeBackupSwitches(listener: () => void): () => void {
  return switchBridge?.subscribe ? switchBridge.subscribe(listener) : () => undefined;
}

export function collectBackup(now = new Date()): SettingsBackup {
  return buildBackup((key) => readString(key), now, readBackupSwitchSnapshot());
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
    if (typeof window !== "undefined" && typeof StorageEvent === "function") {
      window.dispatchEvent(new StorageEvent("storage", { key, oldValue, newValue: value, storageArea: window.localStorage }));
    }
  }
  if (written > 0 && switchBridge) {
    const restored = switchesFromBackup(keys);
    if (restored.plugins.length > 0 || restored.configs.length > 0) switchBridge.apply(restored);
  }
  return written;
}
