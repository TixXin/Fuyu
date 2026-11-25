import { DEFAULT_TIMER_LAYOUT, normalizeTimerLayout, type TimerLayout } from "./timerLayout.ts";

export const DEFAULT_TIMER_SHORTCUT = "Ctrl+Alt+K";

export type TimerConfig = { sound: boolean; shortcut: string; layout: TimerLayout };

export function timerConfig(config: Readonly<Record<string, unknown>>): TimerConfig {
  return {
    sound: config.sound !== false,
    shortcut: typeof config.shortcut === "string" ? config.shortcut.trim() : DEFAULT_TIMER_SHORTCUT,
    layout: normalizeTimerLayout(config.layout),
  };
}

export { DEFAULT_TIMER_LAYOUT };
