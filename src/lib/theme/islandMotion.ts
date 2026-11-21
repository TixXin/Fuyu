import { bounceDamping, ISLAND_BOUNCES } from "./islandBounce.ts";
import { landingCurve, springCurve, springResponse } from "./motionCurves.ts";
import { MOTION_BASE_MS, MOTION_FAST_MS, MOTION_MEDIUM_MS } from "./motionTokens.ts";
import type { IslandBounce, IslandMotion } from "../settings/types";

export const ISLAND_MOTIONS = ["pop", "lively", "spring", "snappy", "soft", "unfold", "grow", "smooth", "fast", "bouncy", "none"] as const satisfies readonly IslandMotion[];

type MotionTiming = {
  width: number;
  widthEase: string;
  height: number;
  heightEase: string;
  radius: number;
  radiusEase: string;
  ease: string;
  fade: number;
  fadeDelay: number;
  layer: number;
  collapsedDelay: number;
  bloom: number;
  bounces?: true;
  widthDelay?: number;
  heightDelay?: number;
  contentBlur?: number;
  contentScale?: number;
};

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const SPRING = "cubic-bezier(0.34, 1.36, 0.5, 1)";
const EASE_IN_OUT = "cubic-bezier(0.4, 0, 0.2, 1)";
const EASE_OUT_CUBIC = "cubic-bezier(0.33, 1, 0.68, 1)";

const WEBSITE_OPEN: MotionTiming = {
  width: 550, widthEase: SPRING, height: 500, heightEase: EASE_OUT, radius: 450, radiusEase: EASE_OUT, ease: EASE_OUT, bounces: true,
  fade: 250, fadeDelay: 120, layer: 120, collapsedDelay: 140, bloom: 440,
};
const WEBSITE_CLOSE: MotionTiming = { ...WEBSITE_OPEN, layer: 250, collapsedDelay: 220, bloom: 360 };

const QUICK_CLOSE: MotionTiming = {
  width: 400, widthEase: EASE_OUT, height: 380, heightEase: EASE_OUT, radius: 340, radiusEase: EASE_OUT, ease: EASE_OUT,
  fade: 120, fadeDelay: 0, layer: 120, collapsedDelay: 100, bloom: 360,
};
const NONE: MotionTiming = {
  width: 0, widthEase: EASE_OUT, height: 0, heightEase: EASE_OUT, radius: 0, radiusEase: EASE_OUT, ease: EASE_OUT, fade: 0, fadeDelay: 0, layer: 0, collapsedDelay: 0, bloom: 0,
};

const JELLY_OPEN: MotionTiming = {
  width: 680, widthEase: springCurve(0.55),
  height: 560, heightEase: landingCurve(0.5, [{ depth: 0.06, length: 0.24 }, { depth: 0.015, length: 0.16 }]),
  radius: 578, radiusEase: springCurve(0.5), ease: EASE_OUT,
  fade: 250, fadeDelay: 160, layer: 120, collapsedDelay: 140, bloom: 440, bounces: true,
};
const JELLY_CLOSE: MotionTiming = {
  width: 600, widthEase: springCurve(0.64),
  height: 540, heightEase: landingCurve(0.42, [{ depth: 0.05, length: 0.24 }, { depth: 0.0125, length: 0.16 }]),
  radius: 510, radiusEase: springCurve(0.55), ease: EASE_OUT,
  fade: 120, fadeDelay: 0, layer: 200, collapsedDelay: 287, bloom: 360, bounces: true,
};

const SNAPPY_OPEN: MotionTiming = {
  width: 340, widthEase: springCurve(0.7),
  height: 380, heightEase: landingCurve(0.42, [{ depth: 0.03, length: 0.2 }]),
  radius: 340, radiusEase: springCurve(0.75), ease: EASE_OUT,
  fade: 180, fadeDelay: 60, layer: 100, collapsedDelay: 60, bloom: 300, bounces: true,
};
const SNAPPY_CLOSE: MotionTiming = {
  width: 240, widthEase: springCurve(0.85),
  height: 260, heightEase: EASE_OUT,
  radius: 240, radiusEase: EASE_OUT, ease: EASE_OUT,
  fade: 100, fadeDelay: 0, layer: 100, collapsedDelay: 140, bloom: 220,
};

const LIVELY_OPEN: MotionTiming = {
  width: 450, widthEase: springCurve(0.53),
  height: 480, heightEase: springCurve(0.75), heightDelay: 30,
  radius: 450, radiusEase: springCurve(0.6), ease: EASE_OUT,
  fade: 110, fadeDelay: 0, layer: 80, collapsedDelay: 140, bloom: 360, contentBlur: 10, bounces: true,
};
const LIVELY_CLOSE: MotionTiming = {
  width: 300, widthEase: springCurve(0.9),
  height: 280, heightEase: EASE_IN_OUT,
  radius: 280, radiusEase: EASE_IN_OUT, ease: EASE_IN_OUT,
  fade: 90, fadeDelay: 0, layer: 120, collapsedDelay: 160, bloom: 280, contentBlur: 10,
};

const POP_WIDTH = { damping: 0.6, omega: 19.5, cap: 680 };
const POP_HEIGHT = { damping: 0.66, omega: 16.5, cap: 530, floor: 0.62, delay: 30 };
const POP_CLOSE = { damping: 1, omega: 21.5, ms: 400, delay: 18 };
const settleMs = (damping: number, omega: number, cap: number) => Math.min(cap, Math.ceil(620 / (damping * omega)) * 10);

function popOpen(bounce: IslandBounce): MotionTiming {
  const widthDamping = bounceDamping(POP_WIDTH.damping, bounce);
  const heightDamping = bounceDamping(POP_HEIGHT.damping, bounce, POP_HEIGHT.floor);
  const width = settleMs(widthDamping, POP_WIDTH.omega, POP_WIDTH.cap);
  const height = settleMs(heightDamping, POP_HEIGHT.omega, POP_HEIGHT.cap);
  const heightEase = springResponse(heightDamping, POP_HEIGHT.omega, height);
  return {
    width, widthEase: springResponse(widthDamping, POP_WIDTH.omega, width),
    height, heightEase, heightDelay: POP_HEIGHT.delay,
    radius: height, radiusEase: heightEase, ease: EASE_OUT,
    fade: 220, fadeDelay: 20, layer: 60, collapsedDelay: 140, bloom: 360, contentBlur: 14, bounces: true,
  };
}

function popClose(bounce: IslandBounce): MotionTiming {
  const damping = bounceDamping(POP_CLOSE.damping, bounce);
  const ease = springResponse(damping, POP_CLOSE.omega, POP_CLOSE.ms);
  return {
    width: POP_CLOSE.ms, widthEase: ease,
    height: POP_CLOSE.ms, heightEase: ease, heightDelay: POP_CLOSE.delay,
    radius: POP_CLOSE.ms, radiusEase: ease, ease: EASE_OUT_CUBIC,
    fade: 60, fadeDelay: 0, layer: 60, collapsedDelay: damping < 1 ? 260 : 200, bloom: 300,
  };
}

const POP = Object.fromEntries(ISLAND_BOUNCES.map((bounce) => [bounce, { open: popOpen(bounce), close: popClose(bounce) }])) as Record<IslandBounce, { open: MotionTiming; close: MotionTiming }>;

const SOFT_OPEN: MotionTiming = {
  width: 480, widthEase: springCurve(0.8), height: 480, heightEase: springCurve(0.8), radius: 480, radiusEase: springCurve(0.8), ease: EASE_OUT,
  fade: 200, fadeDelay: 140, layer: 100, collapsedDelay: 140, bloom: 400,
};
const SOFT_CLOSE: MotionTiming = {
  width: 340, widthEase: springCurve(0.85), height: 340, heightEase: springCurve(0.85), radius: 340, radiusEase: springCurve(0.85), ease: EASE_OUT,
  fade: 100, fadeDelay: 0, layer: 140, collapsedDelay: 180, bloom: 300,
};

const UNFOLD_OPEN: MotionTiming = {
  width: 300, widthEase: EASE_OUT, height: 380, heightEase: EASE_OUT, heightDelay: 90, radius: 380, radiusEase: EASE_OUT, ease: EASE_OUT,
  fade: 200, fadeDelay: 170, layer: 90, collapsedDelay: 140, bloom: 400,
};
const UNFOLD_CLOSE: MotionTiming = {
  width: 260, widthEase: EASE_OUT, widthDelay: 120, height: 240, heightEase: EASE_IN_OUT, radius: 260, radiusEase: EASE_OUT, ease: EASE_OUT,
  fade: 90, fadeDelay: 0, layer: 140, collapsedDelay: 300, bloom: 300,
};

const GROW_OPEN: MotionTiming = {
  width: 420, widthEase: springCurve(0.6), height: 440, heightEase: springCurve(0.68), radius: 420, radiusEase: springCurve(0.65), ease: EASE_OUT,
  fade: 160, fadeDelay: 20, layer: 80, collapsedDelay: 140, bloom: 380, contentScale: 0.92, bounces: true,
};
const GROW_CLOSE: MotionTiming = {
  width: 280, widthEase: springCurve(0.9), height: 280, heightEase: EASE_IN_OUT, radius: 280, radiusEase: EASE_IN_OUT, ease: EASE_IN_OUT,
  fade: 90, fadeDelay: 0, layer: 120, collapsedDelay: 150, bloom: 280, contentScale: 0.92,
};

const PRESETS: Record<IslandMotion, { open: MotionTiming; close: MotionTiming }> = {
  pop: POP.regular,
  lively: { open: LIVELY_OPEN, close: LIVELY_CLOSE },
  spring: { open: WEBSITE_OPEN, close: WEBSITE_CLOSE },
  snappy: { open: SNAPPY_OPEN, close: SNAPPY_CLOSE },
  soft: { open: SOFT_OPEN, close: SOFT_CLOSE },
  unfold: { open: UNFOLD_OPEN, close: UNFOLD_CLOSE },
  grow: { open: GROW_OPEN, close: GROW_CLOSE },
  smooth: {
    open: { width: 560, widthEase: EASE_OUT_EXPO, height: 560, heightEase: EASE_OUT_EXPO, radius: 560, radiusEase: EASE_OUT_EXPO, ease: EASE_OUT_EXPO, fade: 260, fadeDelay: 160, layer: 120, collapsedDelay: 140, bloom: 440 },
    close: { ...QUICK_CLOSE, widthEase: EASE_OUT_EXPO, heightEase: EASE_OUT_EXPO, radiusEase: EASE_OUT_EXPO, ease: EASE_OUT_EXPO },
  },
  fast: {
    open: { width: 280, widthEase: EASE_OUT, height: 260, heightEase: EASE_OUT, radius: 240, radiusEase: EASE_OUT, ease: EASE_OUT, fade: 160, fadeDelay: 40, layer: 100, collapsedDelay: 60, bloom: 240 },
    close: { width: 200, widthEase: EASE_OUT, height: 200, heightEase: EASE_OUT, radius: 180, radiusEase: EASE_OUT, ease: EASE_OUT, fade: 100, fadeDelay: 0, layer: 100, collapsedDelay: 50, bloom: 200 },
  },
  bouncy: { open: JELLY_OPEN, close: JELLY_CLOSE },
  none: { open: NONE, close: NONE },
};

export function islandMotionTiming(motion: IslandMotion, direction: "open" | "close", reducedMotion = false, bounce: IslandBounce = "regular"): MotionTiming {
  const timing = (motion === "pop" ? POP[bounce] : PRESETS[motion])[direction];
  return reducedMotion ? calmed(timing, direction === "open" ? MOTION_MEDIUM_MS : MOTION_BASE_MS) : timing;
}

function calmed(timing: MotionTiming, cap: number): MotionTiming {
  const shell = Math.min(timing.height, cap);
  const fade = Math.min(timing.fade, MOTION_BASE_MS);
  return {
    width: Math.min(timing.width, cap), widthEase: EASE_OUT,
    height: shell, heightEase: EASE_OUT,
    radius: Math.min(timing.radius, cap), radiusEase: EASE_OUT, ease: EASE_OUT,
    fade, fadeDelay: Math.max(0, Math.min(timing.fadeDelay, shell - fade)),
    layer: Math.min(timing.layer, MOTION_FAST_MS),
    collapsedDelay: Math.min(timing.collapsedDelay, Math.round(shell * 0.6)),
    bloom: Math.min(timing.bloom, shell),
  };
}

export function islandMotionVariables(motion: IslandMotion, direction: "open" | "close", reducedMotion = false, bounce: IslandBounce = "regular"): Record<string, string> {
  const timing = islandMotionTiming(motion, direction, reducedMotion, bounce);
  return {
    "--island-motion-width": `${timing.width}ms`,
    "--island-motion-width-ease": timing.widthEase,
    "--island-motion-height": `${timing.height}ms`,
    "--island-motion-height-ease": timing.heightEase,
    "--island-motion-radius": `${timing.radius}ms`,
    "--island-motion-radius-ease": timing.radiusEase,
    "--island-motion-ease": timing.ease,
    "--island-motion-fade": `${timing.fade}ms`,
    "--island-motion-fade-delay": `${timing.fadeDelay}ms`,
    "--island-motion-collapsed-delay": `${timing.collapsedDelay}ms`,
    "--island-motion-bloom": `${timing.bloom}ms`,
    "--island-motion-layer": `${timing.layer}ms`,
    "--island-motion-width-delay": `${timing.widthDelay ?? 0}ms`,
    "--island-motion-height-delay": `${timing.heightDelay ?? 0}ms`,
    "--island-motion-content-filter": timing.contentBlur ? `blur(${timing.contentBlur}px)` : "none",
    "--island-motion-content-scale": timing.contentScale ? String(timing.contentScale) : "none",
  };
}
