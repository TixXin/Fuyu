import { useEffect } from "react";
import { readString } from "../storage.ts";
import { visibilityInterval } from "../useVisibilityInterval.ts";
import { onSettingsSyncApplied, writeSettingsFile, type SettingsSyncApplied } from "./api";
import { isBackupKey } from "./backup.ts";
import { currentKeys, fingerprint, settingsFileText, type SettingsKeys } from "./settingsFile.ts";
import {
  readBackupSwitchSnapshot,
  readSettingsFileSynced,
  restoreBackup,
  saveSettingsFileSynced,
  subscribeBackupSwitches,
} from "./storage.ts";

const CHECK_MS = 2_000;

export function syncedKeys(applied: SettingsSyncApplied): SettingsKeys {
  const keys: SettingsKeys = {};
  for (const [key, value] of Object.entries(applied.keys)) {
    if (isBackupKey(key) && typeof value === "string") keys[key] = value;
  }
  return keys;
}

export function useSettingsFileSync() {
  useEffect(() => {
    let writing = false;
    const check = () => {
      if (writing) return;
      const keys = currentKeys(readString, readBackupSwitchSnapshot());
      const print = fingerprint(keys);
      if (print === readSettingsFileSynced()) return;
      writing = true;
      void writeSettingsFile(settingsFileText(keys, new Date()))
        .then(() => saveSettingsFileSynced(print))
        .catch((error: unknown) => console.error("Failed to write settings.json", error))
        .finally(() => {
          writing = false;
        });
    };
    check();
    const stopTimer = visibilityInterval(check, CHECK_MS);
    const stopSwitches = subscribeBackupSwitches(check);
    window.addEventListener("storage", check);
    return () => {
      stopTimer();
      stopSwitches();
      window.removeEventListener("storage", check);
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
