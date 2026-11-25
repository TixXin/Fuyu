export const SIDE_SWIPE_THRESHOLD_PX = 72;
export const SIDE_WHEEL_THRESHOLD_PX = 28;
export const SWIPE_QUIET_MS = 120;
export const SWIPE_REACCEL_MS = 280;
export const SWIPE_REVERSE_GRACE_MS = 100;
const SIDEWAYS_RATIO = 1.4;
const IDLE_RESET_MS = 140;

export type SideSwipeTurn = -1 | 1 | null;

export type SideSwipeState = {
  accum: number;
  cross: number;
  lastAt: number;
  lockedDir: -1 | 0 | 1;
  lockedAt: number;
  minMag: number;
};

export const IDLE_SIDE_SWIPE: SideSwipeState = {
  accum: 0,
  cross: 0,
  lastAt: Number.NEGATIVE_INFINITY,
  lockedDir: 0,
  lockedAt: Number.NEGATIVE_INFINITY,
  minMag: Number.POSITIVE_INFINITY,
};

export function stepSideDockGesture(
  state: SideSwipeState,
  primary: number,
  secondary: number,
  now: number,
  thresholdPx: number,
  requireSideways: boolean,
): { state: SideSwipeState; turn: SideSwipeTurn } {
  const mag = Math.abs(primary);
  if (mag < 1) {
    return { state, turn: null };
  }

  const gap = now - state.lastAt;

  if (state.lockedDir !== 0) {
    if (gap >= SWIPE_QUIET_MS) {
      return stepSideDockGesture(IDLE_SIDE_SWIPE, primary, secondary, now, thresholdPx, requireSideways);
    }
    const sign = Math.sign(primary);
    const reverseIntent = sign === -state.lockedDir && now - state.lockedAt >= SWIPE_REVERSE_GRACE_MS;
    const reaccelerated =
      sign === state.lockedDir &&
      now - state.lockedAt >= SWIPE_REACCEL_MS &&
      state.minMag <= 6 &&
      mag >= state.minMag * 2.5 + 8;
    if (reverseIntent || reaccelerated) {
      return stepSideDockGesture(IDLE_SIDE_SWIPE, primary, secondary, now, thresholdPx, requireSideways);
    }
    return {
      state: {
        ...state,
        lastAt: now,
        minMag: Math.min(state.minMag, mag),
      },
      turn: null,
    };
  }

  const base = gap >= IDLE_RESET_MS ? IDLE_SIDE_SWIPE : state;
  const accum = base.accum + primary;
  const cross = base.cross + secondary;
  const next: SideSwipeState = {
    accum,
    cross,
    lastAt: now,
    lockedDir: 0,
    lockedAt: Number.NEGATIVE_INFINITY,
    minMag: Number.POSITIVE_INFINITY,
  };

  if (requireSideways && Math.abs(accum) < Math.abs(cross) * SIDEWAYS_RATIO) {
    return { state: next, turn: null };
  }
  if (Math.abs(accum) < thresholdPx) {
    return { state: next, turn: null };
  }
  const turn: -1 | 1 = accum > 0 ? 1 : -1;
  return {
    state: {
      accum: 0,
      cross: 0,
      lastAt: now,
      lockedDir: turn,
      lockedAt: now,
      minMag: mag,
    },
    turn,
  };
}
