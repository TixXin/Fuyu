// Light, dark or the system's choice (C31): two built-in colour sets the island can use instead of
// the colours picked by hand. Pure functions; useResolvedTheme.ts follows the system setting.
import { isLightIsland } from "../../utils/color.ts";
import type { IslandSettings, ThemeMode } from "./types";

export const THEME_MODES = ["dark", "light", "system", "custom"] as const satisfies readonly ThemeMode[];

/** The colours a built-in theme sets; everything else (style, corners, font) stays the user's. */
type ThemeColors = Pick<IslandSettings, "islandBackgroundColor" | "taskTextColor" | "pulseColor">;

export const THEME_COLORS: Record<"dark" | "light", ThemeColors> = {
  // The island as it ships: black, to blend into the screen's bezel and notch.
  dark: { islandBackgroundColor: "#000000", taskTextColor: "#ffffff", pulseColor: "#3ae489" },
  // A light grey island with near-black text; the green is darker to read on it.
  light: { islandBackgroundColor: "#f2f2f5", taskTextColor: "#1c1c1f", pulseColor: "#1f9d55" },
};

const COLOR_KEYS = ["islandBackgroundColor", "taskTextColor", "pulseColor"] as const;

/** Which built-in colours apply: none for "custom", the system's for "system". */
export function themeColorsFor(mode: ThemeMode, systemDark: boolean): ThemeColors | null {
  if (mode === "custom") return null;
  if (mode === "system") return THEME_COLORS[systemDark ? "dark" : "light"];
  return THEME_COLORS[mode];
}

/** `settings` as the island draws them: a built-in theme's colours in place of the picked ones. */
export function resolveThemeColors(settings: IslandSettings, systemDark: boolean): IslandSettings {
  const colors = themeColorsFor(settings.themeMode, systemDark);
  return colors ? { ...settings, ...colors } : settings;
}

/**
 * The colours the collapsed island shows (C33.2): with "keep dark when collapsed" on, a light
 * island collapses into the dark theme's colours, so the small island still blends into the
 * screen's black top edge and notch; the open panel keeps the light ones.
 */
export function collapsedThemeColors(settings: IslandSettings): IslandSettings {
  return settings.collapsedDark && isLightIsland(settings.islandBackgroundColor) ? { ...settings, ...THEME_COLORS.dark } : settings;
}

/**
 * `next`, worked out from resolved settings, ready to save: while a built-in theme is on, the
 * colours picked by hand are kept, not replaced by the theme's, so "custom" brings them back.
 */
export function keepPickedColors(next: IslandSettings, stored: IslandSettings): IslandSettings {
  if (next.themeMode === "custom") return next;
  const kept = { ...next };
  for (const key of COLOR_KEYS) kept[key] = stored[key];
  return kept;
}
