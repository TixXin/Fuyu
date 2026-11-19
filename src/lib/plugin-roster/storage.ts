import { readJson, readString, writeJson } from "../storage.ts";
import { ROSTER_KEY, ROSTER_LOCAL_KEY, normalizeRosterLocal, parseRoster, type RosterItem, type RosterLocal } from "./roster.ts";

const listeners = new Set<() => void>();

function announce(key: string, oldValue: string | null) {
  for (const listener of listeners) listener();
  if (typeof window === "undefined" || typeof StorageEvent !== "function") return;
  window.dispatchEvent(new StorageEvent("storage", { key, oldValue, newValue: readString(key), storageArea: window.localStorage }));
}

export function loadRoster(): RosterItem[] {
  return parseRoster(readString(ROSTER_KEY));
}

export function saveRoster(items: readonly RosterItem[]) {
  const before = readString(ROSTER_KEY);
  if (writeJson(ROSTER_KEY, items)) announce(ROSTER_KEY, before);
}

export function loadRosterLocal(): RosterLocal {
  return normalizeRosterLocal(readJson(ROSTER_LOCAL_KEY));
}

export function saveRosterLocal(local: RosterLocal) {
  const before = readString(ROSTER_LOCAL_KEY);
  if (writeJson(ROSTER_LOCAL_KEY, local)) announce(ROSTER_LOCAL_KEY, before);
}

export function subscribeRoster(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ROSTER_KEY || event.key === ROSTER_LOCAL_KEY) listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
