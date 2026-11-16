export const DEFAULT_TIMER_SHORTCUT = "Ctrl+Alt+K";

export type TimerConfig = { sound: boolean; shortcut: string };

export function timerConfig(config: Readonly<Record<string, unknown>>): TimerConfig {
  return {
    sound: config.sound !== false,
    shortcut: typeof config.shortcut === "string" ? config.shortcut.trim() : DEFAULT_TIMER_SHORTCUT,
  };
}
