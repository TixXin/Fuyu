import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { isPanelOpen, panelInterval, subscribePanelAwake } from "../../components/island-widget/panelAwake";
import { countdownTickDelay } from "./countdown.ts";
import { dayKey, shiftDays } from "./days.ts";
import type { DailyData } from "./dailyFormat.ts";
import { DAILY_WIDGETS_KEY, KEEP_DAILY_DAYS, readDaily, writeDaily } from "./storage.ts";

let data: DailyData | null = null;
const listeners = new Set<() => void>();

export function currentDaily(): DailyData {
  data ??= readDaily();
  return data;
}

export function commitDaily(next: DailyData) {
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
  return useSyncExternalStore(subscribe, currentDaily);
}

export function useNow(stepMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => panelInterval(() => setNow(new Date()), stepMs), [stepMs]);
  return now;
}

export function useCountdownNow(endsAt: number | null, version: number): number {
  const [now, setNow] = useState(() => Date.now());
  useLayoutEffect(() => {
    setNow(Date.now());
    if (endsAt === null) return;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = undefined;
      if (!isPanelOpen() || document.hidden) return;
      timer = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, countdownTickDelay(endsAt, Date.now()));
    };
    const wake = () => {
      setNow(Date.now());
      schedule();
    };
    schedule();
    const stopAwake = subscribePanelAwake(wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearTimeout(timer);
      stopAwake();
      document.removeEventListener("visibilitychange", wake);
    };
  }, [endsAt, version]);
  return now;
}

export function withCheckin(checkins: readonly string[], day: string): string[] {
  return checkins.includes(day) ? [...checkins] : [...checkins, day].sort();
}

export function addCup(day: string, delta: 1 | -1) {
  const state = currentDaily();
  const cups = Math.min(20, Math.max(0, (state.water[day] ?? 0) + delta));
  commitDaily({ ...state, water: { ...state.water, [day]: cups } });
}

export function toggleHabit(day: string, habit: number) {
  const state = currentDaily();
  const done = state.habits[day] ?? [];
  const next = done.includes(habit) ? done.filter((at) => at !== habit) : [...done, habit].sort();
  commitDaily({ ...state, habits: { ...state.habits, [day]: next } });
}

export function toggleCheckin(day: string) {
  const state = currentDaily();
  const checkins = state.checkins.includes(day) ? state.checkins.filter((item) => item !== day) : withCheckin(state.checkins, day);
  commitDaily({ ...state, checkins });
}

export function setNote(note: string) {
  commitDaily({ ...currentDaily(), note: note.slice(0, 2000) });
}
