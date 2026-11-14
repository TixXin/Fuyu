export type TimerKind = "countdown" | "stopwatch";

export type Timer = {
  id: string;
  kind: TimerKind;
  durationMs: number;
  elapsedMs: number;
  runningSince: number | null;
  alerted: boolean;
};

export const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
export const EXTEND_MS = 5 * 60 * 1000;
export const MAX_TIMERS = 12;

const UNITS: readonly [RegExp, number][] = [
  [/^(h|hr|hrs|hour|hours|小时|时|個小時|个小时)$/, 3600_000],
  [/^(m|min|mins|minute|minutes|分|分钟|分鐘)$/, 60_000],
  [/^(s|sec|secs|second|seconds|秒|秒钟)$/, 1000],
];

function unitMs(unit: string): number | null {
  return UNITS.find(([pattern]) => pattern.test(unit))?.[1] ?? null;
}

export function parseDuration(text: string): number | null {
  const input = text.trim().toLowerCase().replace(/\s+/g, "");
  if (!input) return null;
  let total: number;
  const clock = /^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/.exec(input);
  if (clock) {
    const [first, second, third] = [clock[1], clock[2], clock[3]].map((part) => (part === undefined ? undefined : Number(part)));
    if ((second ?? 0) > 59 || (third ?? 0) > 59) return null;
    total = third === undefined ? (first ?? 0) * 60_000 + (second ?? 0) * 1000 : (first ?? 0) * 3600_000 + (second ?? 0) * 60_000 + third * 1000;
  } else if (/^\d+(\.\d+)?$/.test(input)) {
    total = Number(input) * 60_000;
  } else {
    const parts = [...input.matchAll(/(\d+(?:\.\d+)?)([a-z一-鿿]+)/g)];
    if (parts.length === 0 || parts.map((part) => part[0]).join("") !== input) return null;
    total = 0;
    for (const [, amount, unit] of parts) {
      const ms = unitMs(unit);
      if (ms === null) return null;
      total += Number(amount) * ms;
    }
  }
  total = Math.round(total);
  return total >= 1000 && total <= MAX_DURATION_MS ? total : null;
}

export function elapsedOf(timer: Timer, now: number): number {
  return timer.elapsedMs + (timer.runningSince === null ? 0 : Math.max(0, now - timer.runningSince));
}

export function remainingOf(timer: Timer, now: number): number {
  return Math.max(0, timer.durationMs - elapsedOf(timer, now));
}

export function newCountdown(id: string, durationMs: number, now: number): Timer {
  return { id, kind: "countdown", durationMs, elapsedMs: 0, runningSince: now, alerted: false };
}

export function newStopwatch(id: string, now: number): Timer {
  return { id, kind: "stopwatch", durationMs: 0, elapsedMs: 0, runningSince: now, alerted: false };
}

export function paused(timer: Timer, now: number): Timer {
  if (timer.runningSince === null) return timer;
  const elapsedMs = timer.kind === "countdown" ? Math.min(timer.durationMs, elapsedOf(timer, now)) : elapsedOf(timer, now);
  return { ...timer, elapsedMs, runningSince: null };
}

export function resumed(timer: Timer, now: number): Timer {
  if (timer.runningSince !== null || isFinished(timer, now)) return timer;
  return { ...timer, runningSince: now };
}

export function extended(timer: Timer, now: number, byMs = EXTEND_MS): Timer {
  const elapsed = Math.min(timer.durationMs, elapsedOf(timer, now));
  return { ...timer, durationMs: Math.min(MAX_DURATION_MS, elapsed + byMs), elapsedMs: elapsed, runningSince: now, alerted: false };
}

export function isFinished(timer: Timer, now: number): boolean {
  return timer.kind === "countdown" && remainingOf(timer, now) === 0;
}

export function dueTimers(timers: readonly Timer[], now: number): Timer[] {
  return timers.filter((timer) => isFinished(timer, now) && !timer.alerted);
}

export function nextDueIn(timers: readonly Timer[], now: number): number | null {
  const waits = timers
    .filter((timer) => timer.kind === "countdown" && timer.runningSince !== null && !timer.alerted)
    .map((timer) => remainingOf(timer, now));
  return waits.length > 0 ? Math.min(...waits) : null;
}

export function shownTimer(timers: readonly Timer[], now: number): Timer | null {
  const ringing = timers.find((timer) => isFinished(timer, now) && timer.alerted);
  if (ringing) return ringing;
  const countdowns = timers.filter((timer) => timer.kind === "countdown" && timer.runningSince !== null);
  if (countdowns.length > 0) return countdowns.reduce((best, timer) => (remainingOf(timer, now) < remainingOf(best, now) ? timer : best));
  return timers.find((timer) => timer.runningSince !== null) ?? null;
}

export function shownMs(timer: Timer, now: number): number {
  return timer.kind === "countdown" ? remainingOf(timer, now) : elapsedOf(timer, now);
}

export function clockText(ms: number, roundUp: boolean): string {
  const total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${String(minutes).padStart(2, "0")}:${seconds}`;
}

const finite = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function normalizeTimers(value: unknown): Timer[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const timers: Timer[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string" || !raw.id || seen.has(raw.id)) continue;
    if (raw.kind !== "countdown" && raw.kind !== "stopwatch") continue;
    const durationMs = raw.kind === "countdown" ? raw.durationMs : 0;
    if (raw.kind === "countdown" && !finite(durationMs, 1000, MAX_DURATION_MS)) continue;
    if (!finite(raw.elapsedMs, 0, Number.MAX_SAFE_INTEGER)) continue;
    const runningSince = finite(raw.runningSince, 0, Number.MAX_SAFE_INTEGER) ? (raw.runningSince as number) : null;
    seen.add(raw.id);
    timers.push({ id: raw.id, kind: raw.kind, durationMs: durationMs as number, elapsedMs: raw.elapsedMs as number, runningSince, alerted: raw.alerted === true });
    if (timers.length >= MAX_TIMERS) break;
  }
  return timers;
}
