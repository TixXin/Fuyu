export const WHEEL_THRESHOLD_PX = 50;
export const WHEEL_LINE_PX = 40;
export const WHEEL_SETTLE_MS = 450;
export const WHEEL_EXTEND_MS = 150;
export const WHEEL_IDLE_RESET_MS = 200;

export function normalizeWheelDelta(deltaY: number, deltaX: number, deltaMode: number): number {
  const unit = deltaMode === 1 ? WHEEL_LINE_PX : deltaMode === 2 ? WHEEL_LINE_PX * 10 : 1;
  const primary = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
  return primary * unit;
}

export function stepPageIndex(current: number, step: -1 | 1, count: number): number {
  if (count <= 1) return current;
  return Math.min(Math.max(current + step, 0), count - 1);
}

export function createWheelPageSwitchTracker() {
  let accum = 0;
  let lastAt = 0;
  let settleUntil = 0;

  return {
    feed(deltaPx: number, now: number): -1 | 0 | 1 {
      if (!Number.isFinite(deltaPx) || deltaPx === 0) return 0;
      if (now < settleUntil) {
        settleUntil = Math.max(settleUntil, now + WHEEL_EXTEND_MS);
        accum = 0;
        lastAt = now;
        return 0;
      }
      if (now - lastAt > WHEEL_IDLE_RESET_MS || (accum !== 0 && Math.sign(deltaPx) !== Math.sign(accum))) {
        accum = 0;
      }
      lastAt = now;
      accum += deltaPx;
      if (Math.abs(accum) >= WHEEL_THRESHOLD_PX) {
        const step: -1 | 1 = accum > 0 ? 1 : -1;
        accum = 0;
        settleUntil = now + WHEEL_SETTLE_MS;
        return step;
      }
      return 0;
    },
    reset() {
      accum = 0;
      lastAt = 0;
      settleUntil = 0;
    },
  };
}
