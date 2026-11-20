import { useSyncExternalStore } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { getSystemStats, type SystemStats } from "./api";

const POLL_MS = 2000;
const HISTORY = 24;

export type StatsSnapshot = { stats: SystemStats | null; downs: readonly number[] };

let snapshot: StatsSnapshot = { stats: null, downs: [] };
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function poll() {
  void getSystemStats()
    .then((stats) => {
      const downs = stats.network ? [...snapshot.downs, stats.network.down].slice(-HISTORY) : snapshot.downs;
      snapshot = { stats, downs };
      for (const listener of listeners) listener();
    })
    .catch((failure: unknown) => console.error("Failed to read system stats", failure));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stop) {
    poll();
    stop = visibilityInterval(poll, POLL_MS);
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
