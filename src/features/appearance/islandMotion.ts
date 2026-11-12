// How the island opens and closes (C49): a few presets of the shell's timing, set as CSS
// variables on the stage and read by IslandShell.css and IslandTopEdge.css. Only the shell (no
// text) moves; the content layers only fade (docs/design/island.md, F14). Every preset ends its
// height within 560ms, so the native side's 600ms wait before shrinking the window
// (STAGE_SHRINK_DELAY in src-tauri/src/island/geometry.rs) still covers it.
import type { IslandMotion } from "./types";

export const ISLAND_MOTIONS = ["spring", "smooth", "fast", "bouncy", "none"] as const satisfies readonly IslandMotion[];

/** One direction's timing. */
type MotionTiming = {
  width: number;
  widthEase: string;
  height: number;
  radius: number;
  ease: string;
  /** The expanded layer's fade-in and its delay after the shell starts (opening only). */
  fade: number;
  fadeDelay: number;
  /**
   * The fade of the layer that goes away: the collapsed one as the island opens, the expanded one
   * as it closes; closing, the collapsed layer also fades back in this long.
   */
  layer: number;
  /** How long the collapsed layer waits before fading back in as the island closes. */
  collapsedDelay: number;
  /** The liquid-glass bloom. */
  bloom: number;
};

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
// About 4% past the target and back: the website's top island.
const SPRING = "cubic-bezier(0.34, 1.36, 0.5, 1)";
// About 10% past: livelier, on width and corners only. The height does not overshoot, as the
// window is only as tall as the target; the width is capped at the window's (IslandShell.css).
const BOUNCE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/**
 * The website's top island (fuyu-site src/components/TopIsland.astro), the same both ways: the
 * width springs 550ms (closing, it dips past the collapsed width and back), the height eases out
 * in 500ms and the corners in 450ms. Its menu fades in 250ms after 120ms and out in 250ms at once;
 * its bar stays, which here is the collapsed layer coming back as the panel has faded.
 */
const WEBSITE_OPEN: MotionTiming = {
  width: 550, widthEase: SPRING, height: 500, radius: 450, ease: EASE_OUT,
  fade: 250, fadeDelay: 120, layer: 120, collapsedDelay: 140, bloom: 440,
};
const WEBSITE_CLOSE: MotionTiming = { ...WEBSITE_OPEN, layer: 250, collapsedDelay: 220, bloom: 360 };

// The other presets close quicker than they open and never overshoot.
const QUICK_CLOSE: MotionTiming = {
  width: 400, widthEase: EASE_OUT, height: 380, radius: 340, ease: EASE_OUT,
  fade: 120, fadeDelay: 0, layer: 120, collapsedDelay: 100, bloom: 360,
};
const NONE: MotionTiming = {
  width: 0, widthEase: EASE_OUT, height: 0, radius: 0, ease: EASE_OUT, fade: 0, fadeDelay: 0, layer: 0, collapsedDelay: 0, bloom: 0,
};

const PRESETS: Record<IslandMotion, { open: MotionTiming; close: MotionTiming }> = {
  spring: { open: WEBSITE_OPEN, close: WEBSITE_CLOSE },
  // The island before the website's rhythm (before 2026-11-12): one ease-out, no overshoot.
  smooth: {
    open: { width: 560, widthEase: EASE_OUT_EXPO, height: 560, radius: 560, ease: EASE_OUT_EXPO, fade: 260, fadeDelay: 160, layer: 120, collapsedDelay: 140, bloom: 440 },
    close: { ...QUICK_CLOSE, widthEase: EASE_OUT_EXPO, ease: EASE_OUT_EXPO },
  },
  fast: {
    open: { width: 280, widthEase: EASE_OUT, height: 260, radius: 240, ease: EASE_OUT, fade: 160, fadeDelay: 40, layer: 100, collapsedDelay: 60, bloom: 240 },
    close: { width: 200, widthEase: EASE_OUT, height: 200, radius: 180, ease: EASE_OUT, fade: 100, fadeDelay: 0, layer: 100, collapsedDelay: 50, bloom: 200 },
  },
  bouncy: {
    open: { ...WEBSITE_OPEN, width: 580, widthEase: BOUNCE, height: 520, radius: 480 },
    close: QUICK_CLOSE,
  },
  none: { open: NONE, close: NONE },
};

/**
 * The timing of one direction: opening when the island goes to `expanded`, closing when it goes
 * to `collapsed` (a CSS transition takes the timing of the state it goes to). With the system's
 * "reduce motion", the overshooting presets settle without it.
 */
export function islandMotionTiming(motion: IslandMotion, direction: "open" | "close", reducedMotion = false): MotionTiming {
  const timing = PRESETS[motion][direction];
  if (!reducedMotion || (timing.widthEase !== SPRING && timing.widthEase !== BOUNCE)) return timing;
  return { ...timing, widthEase: EASE_OUT };
}

/** The CSS variables IslandShell.css and IslandTopEdge.css read. */
export function islandMotionVariables(motion: IslandMotion, direction: "open" | "close", reducedMotion = false): Record<string, string> {
  const timing = islandMotionTiming(motion, direction, reducedMotion);
  return {
    "--island-motion-width": `${timing.width}ms`,
    "--island-motion-width-ease": timing.widthEase,
    "--island-motion-height": `${timing.height}ms`,
    "--island-motion-radius": `${timing.radius}ms`,
    "--island-motion-ease": timing.ease,
    "--island-motion-fade": `${timing.fade}ms`,
    "--island-motion-fade-delay": `${timing.fadeDelay}ms`,
    "--island-motion-collapsed-delay": `${timing.collapsedDelay}ms`,
    "--island-motion-bloom": `${timing.bloom}ms`,
    "--island-motion-layer": `${timing.layer}ms`,
  };
}
