import { useSyncExternalStore } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { getPeripheralBatteries, listenPeripheralBatteries, type PeripheralBattery } from "./api";

const POLL_MS = 60_000;

export type PeripheralBatteries = { list: readonly PeripheralBattery[]; loaded: boolean };

let snapshot: PeripheralBatteries = { list: [], loaded: false };
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function set(list: readonly PeripheralBattery[]) {
  snapshot = { list, loaded: true };
  for (const listener of listeners) listener();
}

function read() {
  void getPeripheralBatteries()
    .then(set)
    .catch((failure: unknown) => console.error("Failed to read peripheral batteries", failure));
}

function start() {
  let alive = true;
  let unlisten: (() => void) | null = null;
  void listenPeripheralBatteries(set)
    .then((stopListening) => {
      if (alive) unlisten = stopListening;
      else stopListening();
    })
    .catch((failure: unknown) => console.error("Failed to listen for peripheral batteries", failure));
  read();
  const stopPolling = visibilityInterval(read, POLL_MS);
  return () => {
    alive = false;
    unlisten?.();
    stopPolling();
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  stop ??= start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop?.();
      stop = null;
    }
  };
}

export function usePeripheralBatteries(): PeripheralBatteries {
  return useSyncExternalStore(subscribe, () => snapshot);
}
