import { useEffect } from "react";
import { readString } from "../storage.ts";
import { visibilityInterval } from "../useVisibilityInterval.ts";
import { onSettingsSyncApplied, writeSettingsFile, type SettingsSyncApplied } from "./api.ts";
import { isBackupKey, type BuiltinSwitchSnapshot } from "./backup.ts";
import { currentKeys, fingerprint, settingsFileText, type SettingsKeys } from "./settingsFile.ts";
import {
  readBackupSwitchSnapshot,
  readSettingsFileSynced,
  restoreBackup,
  saveSettingsFileSynced,
  subscribeBackupSwitches,
} from "./storage.ts";

const CHECK_MS = 2_000;
export const SETTINGS_FILE_WRITE_DEBOUNCE_MS = 800;

export function syncedKeys(applied: SettingsSyncApplied): SettingsKeys {
  const keys: SettingsKeys = {};
  for (const [key, value] of Object.entries(applied.keys)) {
    if (isBackupKey(key) && typeof value === "string") keys[key] = value;
  }
  return keys;
}

export function shouldSyncStorageKey(key: string | null | undefined): boolean {
  return key === null || (typeof key === "string" && isBackupKey(key));
}

export type SettingsFileSyncControllerOptions = {
  readKey?: (key: string) => string | null;
  readSwitches?: () => BuiltinSwitchSnapshot | null;
  readSynced?: () => string | null;
  saveSynced?: (print: string) => void;
  writeFile?: (text: string) => Promise<void>;
  now?: () => Date;
  debounceMs?: number;
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void;
};

export function createSettingsFileSyncController(options: SettingsFileSyncControllerOptions = {}) {
  const readKey = options.readKey ?? readString;
  const readSwitches = options.readSwitches ?? readBackupSwitchSnapshot;
  const readSynced = options.readSynced ?? readSettingsFileSynced;
  const saveSynced = options.saveSynced ?? saveSettingsFileSynced;
  const writeFile = options.writeFile ?? writeSettingsFile;
  const now = options.now ?? (() => new Date());
  const debounceMs = options.debounceMs ?? SETTINGS_FILE_WRITE_DEBOUNCE_MS;
  const setTimer = options.setTimer ?? ((callback, ms) => globalThis.setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((id) => globalThis.clearTimeout(id));

  let writing = false;
  let queuedAfterWrite = false;
  let debounceId: ReturnType<typeof setTimeout> | null = null;

  const check = () => {
    if (writing) {
      queuedAfterWrite = true;
      return;
    }
    const keys = currentKeys(readKey, readSwitches());
    const print = fingerprint(keys);
    if (print === readSynced()) return;
    writing = true;
    void writeFile(settingsFileText(keys, now()))
      .then(() => saveSynced(print))
      .catch((error: unknown) => console.error("Failed to write settings.json", error))
      .finally(() => {
        writing = false;
        if (queuedAfterWrite) {
          queuedAfterWrite = false;
          if (debounceId === null) check();
        }
      });
  };

  const schedule = () => {
    if (debounceId !== null) clearTimer(debounceId);
    debounceId = setTimer(() => {
      debounceId = null;
      check();
    }, debounceMs);
  };

  const flush = () => {
    if (debounceId === null) return;
    clearTimer(debounceId);
    debounceId = null;
    check();
  };

  const poll = () => {
    if (debounceId !== null) return;
    check();
  };

  const onStorage = (event: { key?: string | null }) => {
    if (!shouldSyncStorageKey(event.key ?? null)) return;
    schedule();
  };

  return {
    check,
    schedule,
    flush,
    poll,
    onStorage,
  };
}

export function useSettingsFileSync() {
  useEffect(() => {
    const controller = createSettingsFileSyncController();
    controller.check();
    const stopTimer = visibilityInterval(controller.poll, CHECK_MS);
    const stopSwitches = subscribeBackupSwitches(controller.schedule);
    const onVisibilityChange = () => {
      if (document.hidden) controller.flush();
    };
    window.addEventListener("storage", controller.onStorage);
    window.addEventListener("pagehide", controller.flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      controller.flush();
      stopTimer();
      stopSwitches();
      window.removeEventListener("storage", controller.onStorage);
      window.removeEventListener("pagehide", controller.flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let stop: (() => void) | null = null;
    void onSettingsSyncApplied((applied) => {
      restoreBackup(syncedKeys(applied));
      saveSettingsFileSynced(fingerprint(currentKeys(readString, readBackupSwitchSnapshot())));
    }).then((unlisten) => {
      if (active) stop = unlisten;
      else unlisten();
    });
    return () => {
      active = false;
      stop?.();
    };
  }, []);
}
