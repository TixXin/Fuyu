import { useSyncExternalStore } from "react";
import complete from "../../assets/sounds/thumb-piano/complete.wav";
import {
  dueTimers,
  extended,
  MAX_TIMERS,
  newCountdown,
  newStopwatch,
  nextDueIn,
  normalizeTimers,
  paused,
  resumed,
  type Timer,
} from "./timers";

export const TIMERS_KEY = "fuyu-timers";
export const TIMER_PLUGIN_ID = "focusd.timer";
const MAX_WAIT = 2 ** 31 - 1;

type Snapshot = { timers: readonly Timer[]; openRequest: { at: number; focus: boolean } | null };

function load(): Timer[] {
  try {
    return normalizeTimers(JSON.parse(localStorage.getItem(TIMERS_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

let snapshot: Snapshot = { timers: load(), openRequest: null };
let enabled = false;
let sound = true;
let alarm = 0;
let counter = 0;
const listeners = new Set<() => void>();

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function commit(timers: Timer[]) {
  try {
    localStorage.setItem(TIMERS_KEY, JSON.stringify(timers));
  } catch (error) {
    console.error("Failed to save the timers", error);
  }
  emit({ ...snapshot, timers });
  schedule();
}

function ring() {
  if (!sound) return;
  void new Audio(complete).play().catch((error: unknown) => console.error("Failed to play the timer sound", error));
}

function fire() {
  alarm = 0;
  const now = Date.now();
  const due = new Set(dueTimers(snapshot.timers, now).map((timer) => timer.id));
  if (due.size === 0) {
    schedule();
    return;
  }
  commit(snapshot.timers.map((timer) => (due.has(timer.id) ? { ...paused(timer, now), alerted: true } : timer)));
  ring();
}

function schedule() {
  window.clearTimeout(alarm);
  alarm = 0;
  if (!enabled) return;
  const wait = nextDueIn(snapshot.timers, Date.now());
  if (wait === null) return;
  alarm = window.setTimeout(fire, Math.min(MAX_WAIT, Math.max(0, wait)));
}

function update(id: string, change: (timer: Timer, now: number) => Timer | null) {
  const now = Date.now();
  commit(snapshot.timers.flatMap((timer) => {
    if (timer.id !== id) return [timer];
    const next = change(timer, now);
    return next ? [next] : [];
  }));
}

function nextId(now: number) {
  counter += 1;
  return `${now.toString(36)}-${counter}`;
}

export function configureTimers(on: boolean, withSound: boolean) {
  sound = withSound;
  if (on === enabled) return;
  enabled = on;
  schedule();
}

export function startCountdown(durationMs: number): boolean {
  if (snapshot.timers.length >= MAX_TIMERS) return false;
  const now = Date.now();
  commit([...snapshot.timers, newCountdown(nextId(now), durationMs, now)]);
  return true;
}

export function startStopwatch(): boolean {
  if (snapshot.timers.length >= MAX_TIMERS) return false;
  const now = Date.now();
  commit([...snapshot.timers, newStopwatch(nextId(now), now)]);
  return true;
}

export const pauseTimer = (id: string) => update(id, (timer, now) => paused(timer, now));
export const resumeTimer = (id: string) => update(id, (timer, now) => resumed(timer, now));
export const cancelTimer = (id: string) => update(id, () => null);
export const extendTimer = (id: string) => update(id, (timer, now) => extended(timer, now));

export function dismissRinging() {
  commit(snapshot.timers.filter((timer) => !timer.alerted));
}

export function extendRinging() {
  const now = Date.now();
  commit(snapshot.timers.map((timer) => (timer.alerted ? extended(timer, now) : timer)));
}

export function requestTimerPage(focus: boolean) {
  emit({ ...snapshot, openRequest: { at: Date.now(), focus } });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTimers(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}
