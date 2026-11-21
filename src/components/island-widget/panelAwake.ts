import { visibilityInterval } from "../../lib/useVisibilityInterval";

const FRESH_OPEN_MS = 150;

let awake = true;
let opens = 0;
let openedAt = 0;
const listeners = new Set<() => void>();

export function setPanelAwake(next: boolean) {
  if (awake === next) return;
  awake = next;
  if (next) {
    opens += 1;
    openedAt = performance.now();
  }
  for (const listener of listeners) listener();
}

export function panelInterval(callback: () => void, delayMs: number): () => void {
  let stop: (() => void) | null = null;
  const sync = () => {
    if (awake && !stop) {
      callback();
      stop = visibilityInterval(callback, delayMs);
    } else if (!awake && stop) {
      stop();
      stop = null;
    }
  };
  if (awake) stop = visibilityInterval(callback, delayMs);
  listeners.add(sync);
  return () => {
    listeners.delete(sync);
    stop?.();
  };
}

export function subscribePanelAwake(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isPanelOpen(): boolean {
  return awake;
}

export function panelOpens(): number {
  return opens;
}

export function panelOpenIsFresh(): boolean {
  return awake && opens > 0 && performance.now() - openedAt < FRESH_OPEN_MS;
}
