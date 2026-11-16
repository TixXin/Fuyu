import { useLayoutEffect, useSyncExternalStore } from "react";

export interface RunnerStore<T> {
  get(): T;
  use(): T;
  useProvide(value: T): void;
}

export function createRunnerStore<T>(initial: T): RunnerStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  const set = (next: T) => {
    if (Object.is(next, value)) return;
    value = next;
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const get = () => value;
  return {
    get,
    use: () => useSyncExternalStore(subscribe, get, get),
    useProvide(next) {
      useLayoutEffect(() => set(next), [next]);
      useLayoutEffect(() => () => set(initial), []);
    },
  };
}
