import { useSyncExternalStore } from "react";
import type { SlotTitle } from "./slotTitle.ts";

export type PluginNameInput = { id?: unknown; displayName?: unknown };

type Names = ReadonlyMap<string, SlotTitle>;

let names: Names = new Map();
const listeners = new Set<() => void>();

const isTitle = (value: unknown): value is SlotTitle =>
  typeof value === "string" || (value !== null && typeof value === "object" && !Array.isArray(value));

const same = (next: Names) =>
  next.size === names.size && [...next].every(([id, title]) => JSON.stringify(names.get(id)) === JSON.stringify(title));

export function updatePluginNames(plugins: readonly PluginNameInput[]) {
  const next = new Map<string, SlotTitle>();
  for (const plugin of plugins) {
    if (typeof plugin?.id === "string" && isTitle(plugin.displayName)) next.set(plugin.id, plugin.displayName);
  }
  if (same(next)) return;
  names = next;
  for (const listener of listeners) listener();
}

export function pluginNames(): Names {
  return names;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePluginNames(): Names {
  return useSyncExternalStore(subscribe, pluginNames, pluginNames);
}
