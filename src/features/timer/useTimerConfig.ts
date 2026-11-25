import { useCallback, useMemo, useSyncExternalStore } from "react";
import { builtinPlugins, setBuiltinConfig } from "../plugin-kernel/builtinSwitches";
import { useBuiltinConfig } from "../plugin-kernel/useBuiltinPlugins";
import { OWNER } from "./plugin/owner.ts";
import { DEFAULT_TIMER_LAYOUT, DEFAULT_TIMER_SHORTCUT, timerConfig, type TimerConfig } from "./timerConfig.ts";
import type { TimerLayout } from "./timerLayout.ts";

type ConfigValue = boolean | string | TimerLayout;

let localOverrides: Partial<TimerConfig> = {};
const overrideListeners = new Set<() => void>();

function setLocalOverride<K extends keyof TimerConfig>(key: K, value: TimerConfig[K]) {
  localOverrides = { ...localOverrides, [key]: value };
  for (const listener of overrideListeners) listener();
}

function clearLocalOverride(key: keyof TimerConfig) {
  if (!(key in localOverrides)) return;
  const next = { ...localOverrides };
  delete next[key];
  localOverrides = next;
  for (const listener of overrideListeners) listener();
}

function subscribeOverrides(listener: () => void) {
  overrideListeners.add(listener);
  return () => {
    overrideListeners.delete(listener);
  };
}

function defaultOf(key: keyof TimerConfig): ConfigValue {
  if (key === "sound") return true;
  if (key === "layout") return DEFAULT_TIMER_LAYOUT;
  return DEFAULT_TIMER_SHORTCUT;
}

function save<K extends keyof TimerConfig>(key: K, value: TimerConfig[K]) {
  setLocalOverride(key, value);
  const fallback = defaultOf(key);
  void setBuiltinConfig(OWNER, key, value === fallback ? null : value)
    .then(() => {
      if (builtinPlugins()?.some((plugin) => plugin.id === OWNER)) clearLocalOverride(key);
    })
    .catch((error: unknown) => console.error(`Could not save the timer's ${key}`, error));
}

export function useTimerConfig(): [TimerConfig, <K extends keyof TimerConfig>(key: K, value: TimerConfig[K]) => void] {
  const raw = useBuiltinConfig(OWNER);
  const overrides = useSyncExternalStore(subscribeOverrides, () => localOverrides);
  const config = useMemo(() => ({ ...timerConfig(raw), ...overrides }), [raw, overrides]);
  const update = useCallback(<K extends keyof TimerConfig>(key: K, value: TimerConfig[K]) => save(key, value), []);
  return [config, update];
}
