import { springResponse } from "./motionCurves.ts";
import type { WidgetEntranceEffect } from "./widgetEntrance.ts";

export type EntranceBox = { left: number; top: number; width: number; height: number };
export type EntrancePoint = { x: number; y: number };
export type EntranceScene = {
  cards: readonly EntranceBox[];
  origin: EntrancePoint;
  mascot: (EntrancePoint & { card: number }) | null;
  width: number;
  height: number;
  step: number;
  accents: readonly string[];
};
export type EntrancePart = "plate" | "cell" | "band" | "skeleton" | "sweep" | "trace" | "stroke" | "board" | "mascot";
export type EntranceFrames = Record<string, string | number>[];
export type EntranceStep = { card: number; part: EntrancePart; frames: EntranceFrames; delay: number; duration: number; easing: string; iterations?: number };
export type EntrancePlan = { steps: EntranceStep[]; ready: number[]; total: number };

export const ENTRANCE_PLATE_RADIUS = 16;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_IN_OUT = "cubic-bezier(0.45, 0, 0.2, 1)";
const LATEST_START = 300;
const curves = new Map<string, { duration: number; easing: string }>();

function spring(damping: number, omega: number) {
  const key = `${damping}/${omega}`;
  let curve = curves.get(key);
  if (!curve) {
    const duration = Math.min(900, Math.ceil(620 / (damping * omega)) * 10);
    curve = { duration, easing: springResponse(damping, omega, duration) };
    curves.set(key, curve);
  }
  return curve;
}

export function tracePerimeter(box: EntranceBox): number {
  const radius = ENTRANCE_PLATE_RADIUS - 0.75;
  return 2 * (box.width - 1.5 + box.height - 1.5 - 4 * radius) + 2 * Math.PI * radius;
}

type Timing = { delay: number; duration: number; easing?: string; iterations?: number };
type Draft = {
  scene: EntranceScene;
  ready: number[];
  add: (card: number, part: EntrancePart, frames: EntranceFrames, timing: Timing) => void;
  fade: (card: number, part: EntrancePart, delay: number, duration?: number) => void;
};

const centerOf = (box: EntranceBox) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
const far = (box: EntranceBox, from: EntrancePoint) => Math.hypot(centerOf(box).x - from.x, centerOf(box).y - from.y);
const start = (delay: number) => Math.round(Math.min(LATEST_START, delay));

const EFFECTS: Record<WidgetEntranceEffect, (draft: Draft) => void> = {
  spread({ scene, ready, add, fade }) {
    scene.cards.forEach((box, card) => {
      const { x, y } = centerOf(box);
      add(card, "plate", [{ transform: `translate(${(scene.origin.x - x) * 0.6}px, ${(scene.origin.y - y) * 0.6}px) scale(0.72)` }, { transform: "none" }], { delay: 0, ...spring(0.6, 19.5) });
      fade(card, "plate", 10, 150);
      fade(card, "cell", 190, 220);
      ready[card] = 190;
    });
  },
  curtain({ scene, ready, add }) {
    const speed = (2 * scene.height * 0.62) / 420;
    add(-1, "board", [{ maskPosition: "0 100%", webkitMaskPosition: "0 100%" }, { maskPosition: "0 38%", webkitMaskPosition: "0 38%" }], { delay: 60, duration: 420, easing: "linear" });
    scene.cards.forEach((box, card) => {
      ready[card] = start(60 + (box.top + scene.height * 0.12) / speed);
    });
  },
  wave({ scene, ready, add, fade }) {
    scene.cards.forEach((box, card) => {
      const at = start(40 + (far(box, scene.origin) / 950) * 760);
      fade(card, "plate", 20, 160);
      add(card, "band", [{ transform: "translateX(-75%)" }, { transform: "translateX(75%)" }], { delay: Math.max(0, at - 130), duration: 300, easing: "linear" });
      add(card, "plate", [{ filter: "brightness(1)", offset: 0 }, { filter: "brightness(2.4)", offset: 0.3 }, { filter: "brightness(1)", offset: 1 }], { delay: Math.max(0, at - 90), duration: 420, easing: "ease-out" });
      fade(card, "cell", at, 220);
      ready[card] = at;
    });
  },
  ripple({ scene, ready, add, fade }) {
    scene.cards.forEach((box, card) => {
      const at = start(30 + far(box, scene.origin) * 0.34);
      fade(card, "plate", at, 140);
      add(card, "plate", [{ transform: "scale(0.82)" }, { transform: "scale(1)" }], { delay: at, ...spring(0.55, 24) });
      fade(card, "cell", at + 90);
      ready[card] = at + 90;
    });
  },
  skeleton({ scene, ready, add, fade }) {
    const begin = 110;
    const duration = 560;
    const span = scene.width + 340;
    scene.cards.forEach((box, card) => {
      const skew = box.top * 0.35;
      const swap = start(begin + ((centerOf(box).x + skew + 150) / span) * duration);
      const total = swap + 180;
      fade(card, "plate", 20, 160);
      add(card, "skeleton", [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 160 / total }, { opacity: 1, offset: swap / total }, { opacity: 0, offset: 1 }], { delay: 20, duration: total, easing: "linear" });
      add(card, "sweep", [{ backgroundPositionX: `${-260 - box.left - skew}px` }, { backgroundPositionX: `${scene.width + 80 - box.left - skew}px` }], { delay: begin, duration, easing: "linear" });
      fade(card, "cell", swap + 20, 220);
      ready[card] = swap + 20;
    });
  },
  trace({ scene, ready, add, fade }) {
    scene.cards.forEach((box, card) => {
      const at = 20 + Math.min(card, 8) * 30;
      add(card, "trace", [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.7 }, { opacity: 0, offset: 1 }], { delay: at, duration: 640, easing: "linear" });
      add(card, "stroke", [{ strokeDashoffset: tracePerimeter(box) }, { strokeDashoffset: 0 }], { delay: at, duration: 380, easing: EASE_IN_OUT });
      fade(card, "plate", at + 250, 240);
      fade(card, "cell", at + 290, 220);
      ready[card] = at + 290;
    });
  },
  glow({ scene, ready, add, fade }) {
    const count = scene.cards.length;
    const stride = [5, 3, 7, 2, 1].find((candidate) => count % candidate !== 0 || candidate === 1) ?? 1;
    scene.cards.forEach((_, card) => {
      const at = 40 + Math.min((card * stride + 3) % count, 8) * 42;
      const accent = scene.accents[card % scene.accents.length];
      add(card, "plate", [{ opacity: 0, offset: 0 }, { opacity: 0.95, offset: 0.22 }, { opacity: 0.3, offset: 0.4 }, { opacity: 1, offset: 0.62 }, { opacity: 1, offset: 1 }], { delay: at, duration: 300, easing: "linear" });
      add(card, "plate", [{ boxShadow: `0 0 0 1px ${accent}, 0 0 26px ${accent}aa` }, { boxShadow: `0 0 0 0 ${accent}00, 0 0 0 ${accent}00` }], { delay: at, duration: 640 });
      fade(card, "cell", at + 150, 220);
      ready[card] = at + 150;
    });
  },
  drop({ scene, ready, add, fade }) {
    scene.cards.forEach((box, card) => {
      const at = start(30 + (box.left / scene.step) * 24 + (box.top / scene.step) * 36);
      fade(card, "plate", at, 120);
      add(card, "plate", [{ transform: "translateY(-26px) scaleY(0.9)" }, { transform: "none" }], { delay: at, ...spring(0.52, 23) });
      fade(card, "cell", at + 120);
      ready[card] = at + 120;
    });
  },
  bubble({ scene, ready, add, fade }) {
    const first = scene.mascot?.card ?? 0;
    const home = scene.mascot ?? { x: scene.cards[first].left + 40, y: scene.cards[first].top + scene.cards[first].height - 30 };
    add(first, "plate", [{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "scale(1)" }], { delay: 20, duration: 260 });
    fade(first, "cell", 50);
    ready[first] = 50;
    if (scene.mascot) {
      add(first, "mascot", ["scale(1, 1)", "scale(1.2, 0.78)", "scale(0.9, 1.14)", "scale(1, 1)"].map((transform) => ({ transform, transformOrigin: "50% 100%" })), { delay: 90, duration: 230, easing: "ease-in-out", iterations: 2 });
    }
    scene.cards
      .map((box, card) => ({ box, card }))
      .filter(({ card }) => card !== first)
      .sort((a, b) => far(a.box, home) - far(b.box, home))
      .forEach(({ box, card }, order) => {
        const at = 120 + Math.min(order, 7) * 34;
        const { x, y } = centerOf(box);
        fade(card, "plate", at, 100);
        add(card, "plate", [{ transform: `translate(${(home.x - x) * 0.72}px, ${(home.y - y) * 0.72}px) scale(0.18)` }, { transform: "none" }], { delay: at, ...spring(0.5, 20) });
        add(card, "plate", [{ borderRadius: "60px" }, { borderRadius: `${ENTRANCE_PLATE_RADIUS}px` }], { delay: at + 70, duration: 240, easing: "cubic-bezier(0.5, 0, 0.5, 1)" });
        fade(card, "cell", at + 190);
        ready[card] = at + 190;
      });
  },
  focus({ scene, ready, add }) {
    scene.cards.forEach((box, card) => {
      const at = start(30 + ((box.left + box.top) / scene.step) * 22);
      for (const part of ["cell", "plate"] as const) add(card, part, [{ opacity: 0, filter: "blur(12px)" }, { opacity: 1, filter: "blur(0px)" }], { delay: at, duration: 340 });
      add(card, "plate", [{ transform: "scale(1.06)" }, { transform: "scale(1)" }], { delay: at, duration: 420 });
      ready[card] = at + 100;
    });
  },
  flip({ scene, ready, add, fade }) {
    scene.cards.forEach((box, card) => {
      const at = start(30 + ((box.left + box.top) / scene.step) * 30);
      for (const part of ["cell", "plate"] as const) {
        fade(card, part, at, 110);
        add(card, part, [{ transform: "rotateX(-82deg)" }, { transform: "rotateX(0deg)" }], { delay: at, ...spring(0.6, 20) });
      }
      ready[card] = at + 140;
    });
  },
};

export function planEntrance(effect: WidgetEntranceEffect, scene: EntranceScene): EntrancePlan {
  const steps: EntranceStep[] = [];
  const ready = scene.cards.map(() => 0);
  if (scene.cards.length === 0) return { steps, ready, total: 0 };
  const add: Draft["add"] = (card, part, frames, timing) => steps.push({ card, part, frames, easing: EASE_OUT, ...timing });
  const fade: Draft["fade"] = (card, part, delay, duration = 200) => add(card, part, [{ opacity: 0 }, { opacity: 1 }], { delay, duration });
  EFFECTS[effect]({ scene, ready, add, fade });
  const total = Math.max(...steps.map((step) => step.delay + step.duration * (step.iterations ?? 1)));
  return { steps, ready, total };
}
