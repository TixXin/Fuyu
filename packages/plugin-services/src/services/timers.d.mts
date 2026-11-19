import type { ServiceDefinition } from "../define.mjs";

export type TimerKind = "countdown" | "stopwatch";

export type Timer = {
  id: string;
  kind: TimerKind;
  durationMs: number;
  elapsedMs: number;
  runningSince: number | null;
  alerted: boolean;
  /** The plugin that started it, filled in by the host from the caller; missing for timers the user started and for older timers. */
  owner?: string;
  /** Started with `hidden: true`: kept off the built-in timer page and collapsed bar, and when it is due only `due` is sent, with no sound or notice. */
  hidden?: boolean;
};

export type TimersErrorCode = "limit" | "not-found" | "bad-duration";

export type TimersMethods = {
  list(): { timers: Timer[]; at: number };
  start(params: ({ kind: "countdown"; durationMs: number } | { kind: "stopwatch" }) & { hidden?: boolean }): { timer: Timer };
  pause(params: { id: string }): { timer: Timer };
  resume(params: { id: string }): { timer: Timer };
  extend(params: { id: string; byMs?: number }): { timer: Timer };
  remove(params: { id: string }): { removed: boolean };
  /** Removes the timers that are ringing and not hidden. */
  dismissRinging(): { removed: number };
  /** Takes over timers kept elsewhere; their `owner` and `hidden` are ignored, and the caller becomes the owner. */
  adopt(params: { timers: Timer[] }): { timers: Timer[]; added: number; at: number };
};

export type TimersEvents = {
  changed: { timers: Timer[]; at: number };
  due: { timer: Timer; at: number };
};

export const timersV1: ServiceDefinition<TimersMethods, TimersEvents, {}>;
