import { useSyncExternalStore } from "react";
import { panelInterval } from "../../components/island-widget/panelAwake";
import { readJson, writeJson } from "../../lib/storage";
import { getSystemStats, type SystemStats } from "./api";
import {
  appendBatterySample,
  BATTERY_HISTORY_KEY,
  normalizeBatteryHistory,
  type BatteryPoint,
} from "./batteryPrefs";

const POLL_MS = 2000;
const HISTORY = 24;

export type StatsSnapshot = {
  stats: SystemStats | null;
  downs: readonly number[];
  batteryHistory: readonly BatteryPoint[];
};

let snapshot: StatsSnapshot = {
  stats: null,
  downs: [],
  batteryHistory: normalizeBatteryHistory(readJson(BATTERY_HISTORY_KEY)),
};
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function poll() {
  void getSystemStats()
    .then((stats) => {
      const downs = stats.network ? [...snapshot.downs, stats.network.down].slice(-HISTORY) : snapshot.downs;
      let batteryHistory = snapshot.batteryHistory;
      if (stats.battery && typeof stats.battery.level === "number") {
        const next = appendBatterySample(batteryHistory, {
          at: Date.now(),
          level: stats.battery.level,
          pluggedIn: stats.battery.pluggedIn,
        });
        if (next !== batteryHistory) {
          batteryHistory = next;
          writeJson(BATTERY_HISTORY_KEY, batteryHistory);
        }
      }
      snapshot = { stats, downs, batteryHistory };
      for (const listener of listeners) listener();
    })
    .catch((failure: unknown) => console.error("Failed to read system stats", failure));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stop) {
    poll();
    stop = panelInterval(poll, POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop?.();
      stop = null;
    }
  };
}

export function useSystemStats(): StatsSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}
