import { PIXEL_TICK_MS } from "./pixelPoses.ts";

type Wake = () => void;

const due = new Map<Wake, number>();
let timer: number | undefined;
let timerTick = Number.POSITIVE_INFINITY;

export function pixelTick(): number {
  return Math.floor(performance.now() / PIXEL_TICK_MS);
}

function fire() {
  timer = undefined;
  timerTick = Number.POSITIVE_INFINITY;
  const now = pixelTick();
  for (const [wake, tick] of [...due]) {
    if (tick > now) continue;
    due.delete(wake);
    wake();
  }
  arm();
}

function arm() {
  const next = Math.min(...due.values());
  if (next === timerTick) return;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  timerTick = next;
  if (Number.isFinite(next)) timer = window.setTimeout(fire, Math.max(0, next * PIXEL_TICK_MS - performance.now()));
}

export function wakeAt(wake: Wake, tick: number) {
  due.set(wake, tick);
  arm();
}

export function cancelWake(wake: Wake) {
  if (due.delete(wake)) arm();
}
