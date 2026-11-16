import { useCallback, useMemo } from "react";
import { setBuiltinConfig } from "../plugin-kernel/builtinSwitches";
import { useBuiltinConfig } from "../plugin-kernel/useBuiltinPlugins";
import { OWNER } from "./plugin/owner.ts";
import { DEFAULT_TIMER_SHORTCUT, timerConfig, type TimerConfig } from "./timerConfig.ts";

function save(key: keyof TimerConfig, value: boolean | string) {
  const fallback = key === "sound" ? true : DEFAULT_TIMER_SHORTCUT;
  void setBuiltinConfig(OWNER, key, value === fallback ? null : value).catch((error: unknown) => console.error(`Could not save the timer's ${key}`, error));
}

export function useTimerConfig(): [TimerConfig, (key: keyof TimerConfig, value: boolean | string) => void] {
  const raw = useBuiltinConfig(OWNER);
  const config = useMemo(() => timerConfig(raw), [raw]);
  const update = useCallback((key: keyof TimerConfig, value: boolean | string) => save(key, value), []);
  return [config, update];
}
