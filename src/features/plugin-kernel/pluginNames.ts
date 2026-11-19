import { useSyncExternalStore } from "react";
import type { SlotTitle } from "./slotTitle.ts";

export type PluginNameInput = { id?: unknown; displayName?: unknown; icon?: unknown };

type Names = ReadonlyMap<string, SlotTitle>;

let names: Names = new Map();
let icons: ReadonlyMap<string, string> = new Map();
const listeners = new Set<() => void>();

const isTitle = (value: unknown): value is SlotTitle =>
  typeof value === "string" || (value !== null && typeof value === "object" && !Array.isArray(value));

const same = (next: Names) =>
  next.size === names.size && [...next].every(([id, title]) => JSON.stringify(names.get(id)) === JSON.stringify(title));

const sameIcons = (next: ReadonlyMap<string, string>) => next.size === icons.size && [...next].every(([id, path]) => icons.get(id) === path);

export function updatePluginNames(plugins: readonly PluginNameInput[]) {
  const next = new Map<string, SlotTitle>();
  const nextIcons = new Map<string, string>();
  for (const plugin of plugins) {
    if (typeof plugin?.id !== "string") continue;
    if (isTitle(plugin.displayName)) next.set(plugin.id, plugin.displayName);
    if (typeof plugin.icon === "string" && plugin.icon !== "") nextIcons.set(plugin.id, plugin.icon);
  }
  if (same(next) && sameIcons(nextIcons)) return;
  names = next;
  icons = nextIcons;
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

export function pluginIcons(): ReadonlyMap<string, string> {
  return icons;
}

export function usePluginIcons(): ReadonlyMap<string, string> {
  return useSyncExternalStore(subscribe, pluginIcons, pluginIcons);
}

export function usePluginNames(): Names {
  return useSyncExternalStore(subscribe, pluginNames, pluginNames);
}
