import { useCallback, useEffect, useState } from "react";
import { readJson, writeJson } from "../../lib/storage";
import {
  BATTERY_PREFS_EVENT,
  BATTERY_PREFS_KEY,
  normalizeBatteryPrefs,
  type BatteryPrefs,
} from "./batteryPrefs";

export function readBatteryPrefs(): BatteryPrefs {
  return normalizeBatteryPrefs(readJson(BATTERY_PREFS_KEY));
}

export function writeBatteryPrefs(prefs: BatteryPrefs): void {
  writeJson(BATTERY_PREFS_KEY, prefs);
  window.dispatchEvent(new Event(BATTERY_PREFS_EVENT));
}

export function useBatteryPrefs(): [BatteryPrefs, (next: BatteryPrefs) => void] {
  const [prefs, setPrefs] = useState<BatteryPrefs>(readBatteryPrefs);

  useEffect(() => {
    const sync = () => setPrefs(readBatteryPrefs());
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === BATTERY_PREFS_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(BATTERY_PREFS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(BATTERY_PREFS_EVENT, sync);
    };
  }, []);

  const update = useCallback((next: BatteryPrefs) => {
    const normalized = normalizeBatteryPrefs(next);
    setPrefs(normalized);
    writeBatteryPrefs(normalized);
  }, []);

  return [prefs, update];
}
