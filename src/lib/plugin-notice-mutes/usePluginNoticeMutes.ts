import { useCallback, useSyncExternalStore } from "react";
import { PLUGIN_NOTICE_MUTES_KEY, PLUGIN_NOTICE_SENDERS_KEY, loadNoticeMutes, loadNoticeSenders, saveNoticeMuted } from "./storage.ts";

export type PluginNoticeMutes = { mutes: readonly string[]; senders: readonly string[] };

let cached: PluginNoticeMutes | null = null;
const listeners = new Set<() => void>();

function snapshot(): PluginNoticeMutes {
  cached ??= { mutes: loadNoticeMutes(), senders: loadNoticeSenders() };
  return cached;
}

function refresh() {
  cached = null;
  for (const listener of [...listeners]) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === PLUGIN_NOTICE_MUTES_KEY || event.key === PLUGIN_NOTICE_SENDERS_KEY) refresh();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    cached = null;
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function usePluginNoticeMutes(): PluginNoticeMutes & { setMuted: (id: string, muted: boolean) => void } {
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  const setMuted = useCallback((id: string, muted: boolean) => {
    saveNoticeMuted(id, muted);
    refresh();
  }, []);
  return { ...state, setMuted };
}
