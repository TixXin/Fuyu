import type { ServiceDefinition } from "../define.mjs";

export type TimerKind = "countdown" | "stopwatch";

export type Timer = {
  id: string;
  kind: TimerKind;
  durationMs: number;
  elapsedMs: number;
  runningSince: number | null;
  alerted: boolean;
};

export type TimersErrorCode = "limit" | "not-found" | "bad-duration";

export type TimersMethods = {
  list(): { timers: Timer[]; at: number };
  start(params: { kind: "countdown"; durationMs: number } | { kind: "stopwatch" }): { timer: Timer };
  pause(params: { id: string }): { timer: Timer };
  resume(params: { id: string }): { timer: Timer };
  extend(params: { id: string; byMs?: number }): { timer: Timer };
  remove(params: { id: string }): { removed: boolean };
  dismissRinging(): { removed: number };
  adopt(params: { timers: Timer[] }): { timers: Timer[]; added: number; at: number };
};

export type TimersEvents = {
  changed: { timers: Timer[]; at: number };
  due: { timer: Timer; at: number };
};

export const timersV1: ServiceDefinition<TimersMethods, TimersEvents, {}>;
