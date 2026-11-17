export const MOTION_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
export const MOTION_EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const MOTION_EASE_IN_OUT = "cubic-bezier(0.45, 0, 0.55, 1)";
export const MOTION_FAST_MS = 120;
export const MOTION_BASE_MS = 160;
export const MOTION_MEDIUM_MS = 240;
export const MOTION_SLOW_MS = 420;

export const MOTION_CSS_VARIABLES: Record<string, string> = {
  "--motion-ease": MOTION_EASE,
  "--motion-ease-out": MOTION_EASE_OUT,
  "--motion-ease-in-out": MOTION_EASE_IN_OUT,
  "--motion-fast": `${MOTION_FAST_MS}ms`,
  "--motion-base": `${MOTION_BASE_MS}ms`,
  "--motion-medium": `${MOTION_MEDIUM_MS}ms`,
  "--motion-slow": `${MOTION_SLOW_MS}ms`,
};

export const MOTION_CSS_BLOCK = Object.entries(MOTION_CSS_VARIABLES)
  .map(([name, value]) => `  ${name}: ${value};`)
  .join("\n");
