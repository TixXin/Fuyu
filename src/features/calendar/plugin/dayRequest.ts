import { useSyncExternalStore } from "react";

export type DayRequest = { day: number; at: number } | null;

let request: DayRequest = null;
const listeners = new Set<() => void>();

export function requestCalendarDay(day: number | null) {
  request = day === null ? null : { day, at: Date.now() };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const get = () => request;

export function useCalendarDayRequest(): DayRequest {
  return useSyncExternalStore(subscribe, get, get);
}
