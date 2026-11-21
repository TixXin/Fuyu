import { visibilityInterval } from "../../lib/useVisibilityInterval";

let awake = true;
const listeners = new Set<() => void>();

export function setPanelAwake(next: boolean) {
  if (awake === next) return;
  awake = next;
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
