import { landingCurve, springCurve } from "./motionCurves.ts";
import type { IslandMotion } from "./types";

export const ISLAND_MOTIONS = ["spring", "smooth", "fast", "bouncy", "none"] as const satisfies readonly IslandMotion[];

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
};

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const SPRING = "cubic-bezier(0.34, 1.36, 0.5, 1)";

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

const PRESETS: Record<IslandMotion, { open: MotionTiming; close: MotionTiming }> = {
  spring: { open: WEBSITE_OPEN, close: WEBSITE_CLOSE },
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

export function islandMotionTiming(motion: IslandMotion, direction: "open" | "close", reducedMotion = false): MotionTiming {
  const timing = PRESETS[motion][direction];
  if (!reducedMotion || !timing.bounces) return timing;
  return { ...timing, widthEase: EASE_OUT, heightEase: EASE_OUT, radiusEase: EASE_OUT };
}

export function islandMotionVariables(motion: IslandMotion, direction: "open" | "close", reducedMotion = false): Record<string, string> {
  const timing = islandMotionTiming(motion, direction, reducedMotion);
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
  };
}
