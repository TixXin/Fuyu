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
  /** The expanded layer's fade-in and its delay after the shell starts. */
  fade: number;
  fadeDelay: number;
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

// Closing is quicker than opening and never overshoots: the user is done with the panel.
const CLOSE: MotionTiming = {
  width: 400, widthEase: EASE_OUT, height: 380, radius: 340, ease: EASE_OUT,
  fade: 120, fadeDelay: 0, collapsedDelay: 100, bloom: 360,
};

const PRESETS: Record<IslandMotion, { open: MotionTiming; close: MotionTiming }> = {
  spring: {
    open: { width: 550, widthEase: SPRING, height: 500, radius: 450, ease: EASE_OUT, fade: 250, fadeDelay: 120, collapsedDelay: 140, bloom: 440 },
    close: CLOSE,
  },
  // The island before the website's rhythm (before 2026-11-12): one ease-out, no overshoot.
  smooth: {
    open: { width: 560, widthEase: EASE_OUT_EXPO, height: 560, radius: 560, ease: EASE_OUT_EXPO, fade: 260, fadeDelay: 160, collapsedDelay: 140, bloom: 440 },
    close: { ...CLOSE, widthEase: EASE_OUT_EXPO, ease: EASE_OUT_EXPO },
  },
  fast: {
    open: { width: 280, widthEase: EASE_OUT, height: 260, radius: 240, ease: EASE_OUT, fade: 160, fadeDelay: 40, collapsedDelay: 60, bloom: 240 },
    close: { width: 200, widthEase: EASE_OUT, height: 200, radius: 180, ease: EASE_OUT, fade: 100, fadeDelay: 0, collapsedDelay: 50, bloom: 200 },
  },
  bouncy: {
    open: { width: 580, widthEase: BOUNCE, height: 520, radius: 480, ease: EASE_OUT, fade: 250, fadeDelay: 120, collapsedDelay: 140, bloom: 440 },
    close: CLOSE,
  },
  none: {
    open: { width: 0, widthEase: EASE_OUT, height: 0, radius: 0, ease: EASE_OUT, fade: 0, fadeDelay: 0, collapsedDelay: 0, bloom: 0 },
    close: { width: 0, widthEase: EASE_OUT, height: 0, radius: 0, ease: EASE_OUT, fade: 0, fadeDelay: 0, collapsedDelay: 0, bloom: 0 },
  },
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
    // The quick cross-fade of a layer going away: no longer than it was (120ms), none for "none".
    "--island-motion-layer": `${Math.min(120, timing.fade)}ms`,
  };
}
