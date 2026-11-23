import { useSyncExternalStore } from "react";
import { dayKey } from "./days.ts";
import { POMODORO_LENGTHS } from "./dailyFormat.ts";
import { commitDaily, currentDaily, withCheckin } from "./store.ts";

const ANNOUNCE_WITHIN_MS = 10 * 60_000;

export type FinishedPomodoro = { minutes: number; at: number };

let finished: FinishedPomodoro | null = null;
const finishedListeners = new Set<() => void>();

function setFinished(next: FinishedPomodoro | null) {
  if (finished === next) return;
  finished = next;
  for (const listener of finishedListeners) listener();
}

export function useFinishedPomodoro(): FinishedPomodoro | null {
  return useSyncExternalStore(
    (listener) => {
      finishedListeners.add(listener);
      return () => {
        finishedListeners.delete(listener);
      };
    },
    () => finished,
  );
}

export function dismissFinishedPomodoro() {
  setFinished(null);
}

export function pomodoroLeft(now: number): number {
  const { endsAt, leftMs } = currentDaily().pomodoro;
  return endsAt === null ? leftMs : Math.max(0, endsAt - now);
}

export function startPomodoro(now: number) {
  const state = currentDaily();
  if (state.pomodoro.endsAt !== null) return;
  setFinished(null);
  commitDaily({ ...state, pomodoro: { ...state.pomodoro, endsAt: now + state.pomodoro.leftMs } });
}

export function pausePomodoro(now: number) {
  const state = currentDaily();
  if (state.pomodoro.endsAt === null) return;
  commitDaily({ ...state, pomodoro: { ...state.pomodoro, endsAt: null, leftMs: Math.max(1000, state.pomodoro.endsAt - now) } });
}

export function resetPomodoro() {
  const state = currentDaily();
  const { minutes } = state.pomodoro;
  commitDaily({ ...state, pomodoro: { endsAt: null, leftMs: minutes * 60_000, minutes } });
}

export function cyclePomodoroLength() {
  const state = currentDaily();
  if (state.pomodoro.endsAt !== null) return;
  const at = POMODORO_LENGTHS.findIndex((length) => length === state.pomodoro.minutes);
  const minutes = POMODORO_LENGTHS[(at + 1) % POMODORO_LENGTHS.length] ?? POMODORO_LENGTHS[0];
  commitDaily({ ...state, pomodoro: { endsAt: null, leftMs: minutes * 60_000, minutes } });
}

export function settlePomodoro(now: number): FinishedPomodoro | null {
  const state = currentDaily();
  const { endsAt, minutes } = state.pomodoro;
  if (endsAt === null || endsAt > now) return null;
  const day = dayKey(new Date(endsAt));
  commitDaily({
    ...state,
    focus: { ...state.focus, [day]: (state.focus[day] ?? 0) + minutes },
    checkins: withCheckin(state.checkins, day),
    pomodoro: { endsAt: null, leftMs: minutes * 60_000, minutes },
  });
  if (now - endsAt > ANNOUNCE_WITHIN_MS) return null;
  const done = { minutes, at: endsAt };
  setFinished(done);
  return done;
}
