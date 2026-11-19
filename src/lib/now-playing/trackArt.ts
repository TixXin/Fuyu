import { useSyncExternalStore } from "react";

export type TrackArt = {
  cover: string | null;
  sourceLabel: string | null;
  sourceIcon: string | null;
};

let current: TrackArt | null = null;
const listeners = new Set<() => void>();

const same = (left: TrackArt | null, right: TrackArt | null) =>
  left === right || (left !== null && right !== null && left.cover === right.cover && left.sourceLabel === right.sourceLabel && left.sourceIcon === right.sourceIcon);

export function setTrackArt(next: TrackArt | null) {
  if (same(current, next)) return;
  current = next;
  for (const listener of [...listeners]) listener();
}

export function trackArt(): TrackArt | null {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTrackArt(): TrackArt | null {
  return useSyncExternalStore(subscribe, trackArt, trackArt);
}
