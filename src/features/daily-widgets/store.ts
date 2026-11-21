import { useEffect, useState, useSyncExternalStore } from "react";
import { panelInterval } from "../../components/island-widget/panelAwake";
import { dayKey, shiftDays } from "./days.ts";
import { DAILY_WIDGETS_KEY, KEEP_DAILY_DAYS, POMODORO_MS, readDaily, writeDaily, type DailyData } from "./storage.ts";

let data: DailyData | null = null;
const listeners = new Set<() => void>();

function current(): DailyData {
  data ??= readDaily();
  return data;
}

function commit(next: DailyData) {
  data = next;
  writeDaily(next, dayKey(shiftDays(new Date(), -KEEP_DAILY_DAYS)));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== DAILY_WIDGETS_KEY) return;
    data = readDaily();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDaily(): DailyData {
  return useSyncExternalStore(subscribe, current);
}

export function useNow(stepMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => panelInterval(() => setNow(new Date()), stepMs), [stepMs]);
  return now;
}

function withCheckin(checkins: readonly string[], day: string): string[] {
  return checkins.includes(day) ? [...checkins] : [...checkins, day].sort();
}

export function addCup(day: string, delta: 1 | -1) {
  const state = current();
  const cups = Math.min(20, Math.max(0, (state.water[day] ?? 0) + delta));
  commit({ ...state, water: { ...state.water, [day]: cups } });
}

export function toggleHabit(day: string, habit: number) {
  const state = current();
  const done = state.habits[day] ?? [];
  const next = done.includes(habit) ? done.filter((at) => at !== habit) : [...done, habit].sort();
  commit({ ...state, habits: { ...state.habits, [day]: next } });
}

export function toggleCheckin(day: string) {
  const state = current();
  const checkins = state.checkins.includes(day) ? state.checkins.filter((item) => item !== day) : withCheckin(state.checkins, day);
  commit({ ...state, checkins });
}

export function setNote(note: string) {
  commit({ ...current(), note: note.slice(0, 2000) });
}

export function pomodoroLeft(now: number): number {
  const { endsAt, leftMs } = current().pomodoro;
  return endsAt === null ? leftMs : Math.max(0, endsAt - now);
}

export function startPomodoro(now: number) {
  const state = current();
  if (state.pomodoro.endsAt !== null) return;
  commit({ ...state, pomodoro: { endsAt: now + state.pomodoro.leftMs, leftMs: state.pomodoro.leftMs } });
}

export function pausePomodoro(now: number) {
  const state = current();
  if (state.pomodoro.endsAt === null) return;
  commit({ ...state, pomodoro: { endsAt: null, leftMs: Math.max(1000, state.pomodoro.endsAt - now) } });
}

export function resetPomodoro() {
  commit({ ...current(), pomodoro: { endsAt: null, leftMs: POMODORO_MS } });
}

export function settlePomodoro(now: number) {
  const state = current();
  const { endsAt } = state.pomodoro;
  if (endsAt === null || endsAt > now) return;
  const day = dayKey(new Date(endsAt));
  commit({
    ...state,
    focus: { ...state.focus, [day]: (state.focus[day] ?? 0) + POMODORO_MS / 60_000 },
    checkins: withCheckin(state.checkins, day),
    pomodoro: { endsAt: null, leftMs: POMODORO_MS },
  });
}
