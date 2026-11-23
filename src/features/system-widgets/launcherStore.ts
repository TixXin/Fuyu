import { useSyncExternalStore } from "react";
import type { LauncherItem } from "./launcherItems.ts";
import { QUICK_LAUNCH_KEY, readLauncher, writeLauncher } from "./storage.ts";

let items: LauncherItem[] | null = null;
const listeners = new Set<() => void>();

export function currentLauncher(): LauncherItem[] {
  items ??= readLauncher();
  return items;
}

export function commitLauncher(next: LauncherItem[]) {
  items = next;
  writeLauncher(next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== QUICK_LAUNCH_KEY) return;
    items = readLauncher();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useLauncher(): LauncherItem[] {
  return useSyncExternalStore(subscribe, currentLauncher);
}
