import { useSyncExternalStore } from "react";
import type { useSaveDirectorySetting } from "./useSaveDirectorySetting";

export type SaveDirectorySetting = ReturnType<typeof useSaveDirectorySetting>;

let current: SaveDirectorySetting | null = null;
const listeners = new Set<() => void>();

export function holdSaveDirectorySetting(setting: SaveDirectorySetting | null) {
  current = setting;
}

export function announceSaveDirectorySetting() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSharedSaveDirectorySetting() {
  return useSyncExternalStore(subscribe, () => current);
}
