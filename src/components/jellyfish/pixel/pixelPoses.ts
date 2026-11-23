import type { PixelEffectName } from "./pixelEffects.ts";
import type { PixelEffectSlot, PixelEyes, PixelMouth } from "./pixelGrids.ts";

export type PixelMood = "idle" | "running" | "waiting" | "failed" | "done" | "sleep" | "stale" | "compacting";
export type PixelPoseEffect = { name: PixelEffectName; level: number; slot: PixelEffectSlot } | { name: "speed"; frame: number } | { name: "press" };
export type PixelPose = {
  dy: number;
  dx: number;
  lean: number;
  squash: -1 | 0 | 1;
  lobes: readonly number[];
  eyes: PixelEyes;
  eyeDx: number;
  eyeDy: number;
  mouth: PixelMouth;
  effects: readonly PixelPoseEffect[];
};

export const PIXEL_TICK_MS = 120;

const REST: PixelPose = { dy: 0, dx: 0, lean: 0, squash: 0, lobes: [0, 0, 0, 0], eyes: "open", eyeDx: 0, eyeDy: 0, mouth: "none", effects: [] };
const all = (value: number) => [value, value, value, value];
const BLINK_EVERY = 48;
const SWIM_EVERY = 84;
const RUN_LOOP = 8;
const WAIT_LOOP = 20;
const SLEEP_LOOP = 40;
const SQUEEZE_LOOP = 12;
const SETTLED: Partial<Record<PixelMood, number>> = { failed: 7, done: 4, stale: 3 };
const SCAN_LIMIT = 96;

function idle(t: number): PixelPose {
  const swim = t % SWIM_EVERY;
  const eyes: PixelEyes = t % BLINK_EVERY === BLINK_EVERY - 1 ? "blink" : "open";
  if (swim >= 76 && swim < 78) return { ...REST, eyes, lobes: all(-1) };
  if (swim >= 78 && swim < 81) return { ...REST, eyes, dy: -1, lobes: all(1) };
  if (swim >= 81 && swim < 83) return { ...REST, eyes, dy: -1 };
  return { ...REST, eyes };
}

function running(t: number): PixelPose {
  const beat = t % RUN_LOOP;
  return {
    ...REST,
    lean: -1,
    eyeDx: -1,
    mouth: "small",
    dy: beat >= RUN_LOOP / 2 ? -1 : 0,
    lobes: [0, 1, 2, 3].map((lobe) => (Math.floor(beat / 2) === lobe ? -1 : 0)),
    effects: [{ name: "speed", frame: Math.floor(beat / (RUN_LOOP / 2)) }],
  };
}

function waiting(t: number): PixelPose {
  const beat = t % WAIT_LOOP;
  const up = beat < 2 || (beat >= 4 && beat < 6);
  return {
    ...REST,
    lean: 1,
    eyes: beat === 14 ? "blink" : "open",
    eyeDy: -1,
    mouth: "open",
    dy: up ? -2 : 0,
    lobes: up ? all(1) : beat === 2 || beat === 6 ? all(-1) : all(0),
    effects: beat < 8 && beat % 4 !== 3 ? [{ name: "bang", level: 2, slot: "a" }] : [],
  };
}

function failed(t: number): PixelPose {
  return {
    ...REST,
    eyes: "angry",
    squash: t < 4 ? 1 : 0,
    dx: t < 4 ? (t % 2 ? 1 : -1) : 0,
    effects: t < 1 ? [] : [{ name: "anger", level: (t >= 3 && t < 5) || t >= 7 ? 2 : 1, slot: "a" }],
  };
}

function done(t: number): PixelPose {
  const effects: PixelPoseEffect[] = [];
  if (t >= 1) effects.push({ name: "spark", level: Math.min(2, t - 1), slot: "a" });
  if (t >= 3) effects.push({ name: "sparkSmall", level: t < 4 ? 0 : 2, slot: "b" });
  return { ...REST, eyes: "happy", dy: t < 1 ? -1 : t < 3 ? -2 : t < 4 ? -1 : 0, lobes: t < 3 ? all(1) : all(0), effects };
}

function sleep(t: number): PixelPose {
  return { ...REST, eyes: "closed", lobes: t % SLEEP_LOOP < SLEEP_LOOP / 2 ? all(0) : all(-1) };
}

function stale(t: number): PixelPose {
  return { ...REST, lean: 1, eyes: "dot", mouth: "flat", effects: t < 2 ? [] : [{ name: "question", level: t < 3 ? 0 : 2, slot: "a" }] };
}

function compacting(t: number): PixelPose {
  const phase = Math.floor((t % SQUEEZE_LOOP) / (SQUEEZE_LOOP / 4));
  return { ...REST, eyes: "squeeze", mouth: "flat", squash: phase === 0 ? -1 : phase === 2 ? 1 : 0, effects: phase === 0 ? [{ name: "press" }] : [] };
}

const POSES: Record<PixelMood, (t: number) => PixelPose> = { idle, running, waiting, failed, done, sleep, stale, compacting };

export function poseAt(mood: PixelMood, tick: number): PixelPose {
  const settled = SETTLED[mood];
  const t = Math.max(0, Math.floor(tick));
  return POSES[mood](settled === undefined ? t : Math.min(t, settled));
}

export function stillPose(mood: PixelMood): PixelPose {
  if (mood === "waiting") return { ...waiting(8), effects: [{ name: "bang", level: 2, slot: "a" }] };
  return poseAt(mood, SETTLED[mood] ?? 0);
}

export function lookingPose(pose: PixelPose, mood: PixelMood, lookX: number, lookY: number): PixelPose {
  if (mood !== "idle" || (!lookX && !lookY)) return pose;
  return { ...pose, eyeDx: lookX, eyeDy: lookY };
}

export function ticksUntilChange(mood: PixelMood, tick: number): number {
  const settled = SETTLED[mood];
  if (settled !== undefined && tick >= settled) return Number.POSITIVE_INFINITY;
  const now = JSON.stringify(poseAt(mood, tick));
  for (let ahead = 1; ahead <= SCAN_LIMIT; ahead += 1) {
    if (JSON.stringify(poseAt(mood, tick + ahead)) !== now) return ahead;
  }
  return SCAN_LIMIT;
}
