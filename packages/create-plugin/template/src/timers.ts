import type { Timer } from "@fuyu/plugin-services";

export const COUNTDOWN_MS = 25 * 60_000;

export const METHODS = {
  list: "list",
  start: "start",
  dismiss: "dismiss",
} as const;

export const TOPICS = {
  timers: "timers",
} as const;

export type TimerList = { timers: Timer[]; at: number };

export function shownMs(timer: Timer, at: number): number {
  const elapsed = timer.elapsedMs + (timer.runningSince === null ? 0 : Math.max(0, at - timer.runningSince));
  return timer.kind === "countdown" ? Math.max(0, timer.durationMs - elapsed) : elapsed;
}

export function isTicking(timer: Timer, at: number): boolean {
  return timer.runningSince !== null && (timer.kind === "stopwatch" || shownMs(timer, at) > 0);
}

export function formatMs(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
