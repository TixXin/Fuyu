import { useSyncExternalStore } from "react";
import type { BreakProgress } from "./breakReminders.ts";

let current: BreakProgress = {};
const listeners = new Set<() => void>();
const resetListeners = new Set<(id: string) => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function publishBreakProgress(next: BreakProgress) {
  const prevKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  if (prevKeys.length === nextKeys.length && nextKeys.every((key) => current[key] === next[key])) return;
  current = { ...next };
  notify();
}

export function resetBreakProgress(id: string) {
  if (current[id] !== 0) {
    current = { ...current, [id]: 0 };
    notify();
  }
  for (const listener of resetListeners) listener(id);
}

export function subscribeBreakReset(listener: (id: string) => void): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

export function useBreakProgress(): BreakProgress {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
  );
}
