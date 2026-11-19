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
  /** A plugin can only pause its own timers (`owner` is the plugin); anyone else's fail with `not-found`, as if there were no such timer. */
  pause(params: { id: string }): { timer: Timer };
  /** A plugin can only resume its own timers; anyone else's fail with `not-found`. */
  resume(params: { id: string }): { timer: Timer };
  /** A plugin can only extend its own countdowns; anyone else's fail with `not-found`. */
  extend(params: { id: string; byMs?: number }): { timer: Timer };
  /** A plugin can only remove its own timers; for anyone else's it gets `{ removed: false }`, as for an id that does not exist. */
  remove(params: { id: string }): { removed: boolean };
  /** Called by a plugin, removes its own timers that are ringing, hidden or not; anyone else's are left alone. */
  dismissRinging(): { removed: number };
  /** Takes over timers kept elsewhere; their `owner` and `hidden` are ignored, and the caller becomes the owner. Ids that already exist keep the timer that is there, untouched. */
  adopt(params: { timers: Timer[] }): { timers: Timer[]; added: number; at: number };
};

export type TimersEvents = {
  changed: { timers: Timer[]; at: number };
  due: { timer: Timer; at: number };
};

export const timersV1: ServiceDefinition<TimersMethods, TimersEvents, {}>;
