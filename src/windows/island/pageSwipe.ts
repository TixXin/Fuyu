export const SWIPE_DISTANCE_PX = 80;
export const SWIPE_QUIET_MS = 300;
const SIDEWAYS_RATIO = 1.5;
const SETTLED_SHARE = 0.2;
const SETTLED_PX = 3;
const REBOUND_EVENTS = 2;

export type SwipeState = {
  dx: number;
  dy: number;
  last: number;
  fired: -1 | 0 | 1;
  peak: number;
  low: number;
  previous: number;
  rising: number;
};
export type SwipeTurn = -1 | 1 | null;

export const IDLE_SWIPE: SwipeState = { dx: 0, dy: 0, last: Number.NEGATIVE_INFINITY, fired: 0, peak: 0, low: Number.POSITIVE_INFINITY, previous: 0, rising: 0 };

function startsNewSwipe(state: SwipeState, dx: number): boolean {
  if (state.fired === 0) return false;
  const size = Math.abs(dx);
  if (Math.sign(dx) === -state.fired && size >= SETTLED_PX) return true;
  const settled = state.low <= Math.max(SETTLED_PX, state.peak * SETTLED_SHARE);
  return settled && state.rising + 1 >= REBOUND_EVENTS && size > state.previous && size >= state.low * 2 + SETTLED_PX;
}

export function swipeStep(state: SwipeState, dx: number, dy: number, now: number): { state: SwipeState; turn: SwipeTurn } {
  const quiet = now - state.last > SWIPE_QUIET_MS;
  const base = quiet || startsNewSwipe(state, dx) ? IDLE_SWIPE : state;
  const size = Math.abs(dx);
  const next: SwipeState = {
    dx: base.dx + dx,
    dy: base.dy + dy,
    last: now,
    fired: base.fired,
    peak: Math.max(base.peak, size),
    low: base.fired === 0 ? base.low : Math.min(base.low, size),
    previous: size,
    rising: size > base.previous ? base.rising + 1 : 0,
  };
  const sideways = Math.abs(next.dx) >= Math.abs(next.dy) * SIDEWAYS_RATIO;
  if (next.fired !== 0 || !sideways || Math.abs(next.dx) < SWIPE_DISTANCE_PX) return { state: next, turn: null };
  const turn = next.dx > 0 ? 1 : -1;
  return { state: { ...next, fired: turn, low: Number.POSITIVE_INFINITY }, turn };
}

export function wheelPixels(delta: number, deltaMode: number, pageSize: number): number {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * pageSize;
  return delta;
}
