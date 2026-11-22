import { useSyncExternalStore } from "react";

const HOLD_MS = 4000;
const listeners = new Set<() => void>();
let watched = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function set(next: boolean) {
  if (watched === next) return;
  watched = next;
  for (const listener of listeners) listener();
}

export function holdBarMirrorWatch() {
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    set(false);
  }, HOLD_MS);
  set(true);
}

export function endBarMirrorWatch() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  set(false);
}

export function onBarMirrorWatch(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const isBarMirrorWatched = () => watched;

export function useBarMirrorWatched() {
  return useSyncExternalStore(onBarMirrorWatch, isBarMirrorWatched, () => false);
}
