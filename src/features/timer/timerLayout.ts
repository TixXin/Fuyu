import { elapsedOf, isFinished, MAX_DURATION_MS, remainingOf, type Timer } from "./timers.ts";

export const TIMER_LAYOUTS = ["split", "dial", "grid", "hub"] as const;

export type TimerLayout = (typeof TIMER_LAYOUTS)[number];

export const DEFAULT_TIMER_LAYOUT: TimerLayout = "split";

export const TIMER_PRESETS = [1, 3, 5, 10, 15, 25] as const;

export const HUB_PRESETS = [1, 3, 5, 10, 15, 25, 45, 60] as const;

export const MAX_RECENT_MINUTES = 4;

export function normalizeTimerLayout(value: unknown): TimerLayout {
  return typeof value === "string" && (TIMER_LAYOUTS as readonly string[]).includes(value)
    ? (value as TimerLayout)
    : DEFAULT_TIMER_LAYOUT;
}

export function sortPanelTimers(timers: readonly Timer[], now: number): Timer[] {
  return [...timers].sort((a, b) => Number(isFinished(b, now)) - Number(isFinished(a, now)));
}

export function progressOf(timer: Timer, now: number): number {
  if (timer.kind !== "countdown" || timer.durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, elapsedOf(timer, now) / timer.durationMs));
}

export function etaClockText(remainingMs: number, now: number): string {
  const target = new Date(now + Math.max(0, remainingMs));
  return `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}`;
}

export function extendedRunningByMs(timer: Timer, now: number, addMs: number): number {
  const base = isFinished(timer, now) ? 0 : remainingOf(timer, now);
  return Math.min(MAX_DURATION_MS, Math.max(1000, base + addMs));
}

export function normalizeRecentMinutes(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const result: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1 || item > 1440 || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= MAX_RECENT_MINUTES) break;
  }
  return result;
}

export function pushRecentMinutes(current: readonly number[], durationMs: number): number[] {
  if (durationMs < 60_000 || durationMs % 60_000 !== 0) return [...current];
  const minutes = durationMs / 60_000;
  return [minutes, ...current.filter((entry) => entry !== minutes)].slice(0, MAX_RECENT_MINUTES);
}
