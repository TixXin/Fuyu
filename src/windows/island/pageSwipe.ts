export const SWIPE_DISTANCE_PX = 80;
export const SWIPE_QUIET_MS = 300;
const SIDEWAYS_RATIO = 1.5;

export type SwipeState = { dx: number; dy: number; last: number; fired: boolean };
export type SwipeTurn = -1 | 1 | null;

export const IDLE_SWIPE: SwipeState = { dx: 0, dy: 0, last: Number.NEGATIVE_INFINITY, fired: false };

export function swipeStep(state: SwipeState, dx: number, dy: number, now: number): { state: SwipeState; turn: SwipeTurn } {
  const fresh = now - state.last > SWIPE_QUIET_MS;
  const base = fresh ? IDLE_SWIPE : state;
  const next: SwipeState = { dx: base.dx + dx, dy: base.dy + dy, last: now, fired: base.fired };
  const sideways = Math.abs(next.dx) >= Math.abs(next.dy) * SIDEWAYS_RATIO;
  if (next.fired || !sideways || Math.abs(next.dx) < SWIPE_DISTANCE_PX) return { state: next, turn: null };
  return { state: { ...next, fired: true }, turn: next.dx > 0 ? 1 : -1 };
}

export function wheelPixels(delta: number, deltaMode: number, pageSize: number): number {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * pageSize;
  return delta;
}
