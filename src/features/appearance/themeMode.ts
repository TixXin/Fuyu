// Light, dark or the system's choice (C31, C33.3): the island keeps two colour sets, one for dark
// and one for light, each adjustable, and uses one of them. Pure functions; useResolvedTheme.ts
// follows the system setting.
import { getColorSetting, isLightIsland } from "../../utils/color.ts";
import type { IslandSettings, ThemeMode } from "./types";

export const THEME_MODES = ["dark", "light", "system"] as const satisfies readonly ThemeMode[];

export type ThemeTone = "dark" | "light";

/** The colours one set holds; everything else (style, corners, font) is shared. */
export type ThemeColors = Pick<IslandSettings, "islandBackgroundColor" | "taskTextColor" | "pulseColor">;

/** The sets as they ship, and what "reset this set" goes back to. */
export const THEME_COLORS: Record<ThemeTone, ThemeColors> = {
  // The island as it ships: black, to blend into the screen's bezel and notch.
  dark: { islandBackgroundColor: "#000000", taskTextColor: "#ffffff", pulseColor: "#3ae489" },
  // A light grey island with near-black text; the green is darker to read on it.
  light: { islandBackgroundColor: "#f2f2f5", taskTextColor: "#1c1c1f", pulseColor: "#1f9d55" },
};

/** Where each set is saved: flat colour strings, so settings compare and theme files stay plain. */
export const THEME_COLOR_KEYS = {
  dark: { islandBackgroundColor: "darkBackgroundColor", taskTextColor: "darkTextColor", pulseColor: "darkPulseColor" },
  light: { islandBackgroundColor: "lightBackgroundColor", taskTextColor: "lightTextColor", pulseColor: "lightPulseColor" },
} as const satisfies Record<ThemeTone, Record<keyof ThemeColors, keyof IslandSettings>>;

const COLOR_NAMES = ["islandBackgroundColor", "taskTextColor", "pulseColor"] as const;

/** The set the mode uses now: the system's for "system". */
export function activeTone(mode: ThemeMode, systemDark: boolean): ThemeTone {
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

/** One set's colours as saved. */
export function themeColors(settings: IslandSettings, tone: ThemeTone): ThemeColors {
  const keys = THEME_COLOR_KEYS[tone];
  return {
    islandBackgroundColor: settings[keys.islandBackgroundColor],
    taskTextColor: settings[keys.taskTextColor],
    pulseColor: settings[keys.pulseColor],
  };
}

/** `settings` with one set's colours saved as `colors`. */
export function withThemeColors(settings: IslandSettings, tone: ThemeTone, colors: ThemeColors): IslandSettings {
  const keys = THEME_COLOR_KEYS[tone];
  return {
    ...settings,
    [keys.islandBackgroundColor]: colors.islandBackgroundColor,
    [keys.taskTextColor]: colors.taskTextColor,
    [keys.pulseColor]: colors.pulseColor,
  };
}

/** `settings` as the island draws them: the colours of `tone`, or of the set the mode uses. */
export function resolveThemeColors(settings: IslandSettings, systemDark: boolean, tone = activeTone(settings.themeMode, systemDark)): IslandSettings {
  return { ...settings, ...themeColors(settings, tone) };
}

/**
 * The colours the collapsed island shows (C33.2): with "keep dark when collapsed" on, a light
 * island collapses into the dark set's colours, so the small island still blends into the
 * screen's black top edge and notch; the open panel keeps the light ones.
 */
export function collapsedThemeColors(settings: IslandSettings): IslandSettings {
  return settings.collapsedDark && isLightIsland(settings.islandBackgroundColor) ? { ...settings, ...themeColors(settings, "dark") } : settings;
}

/**
 * Settings, or a theme file, from before the two sets (one set of colours, a mode that may be
 * "custom" or missing): the colours go into the set they look like, the other set ships as it
 * does, and the mode becomes that set, so nothing looks different. Returns the fields to merge.
 */
export function themeSetsFromSingleColors(source: Partial<Record<string, unknown>>): Partial<IslandSettings> {
  const picked: ThemeColors = {
    islandBackgroundColor: getColorSetting(source.islandBackgroundColor, THEME_COLORS.dark.islandBackgroundColor),
    taskTextColor: getColorSetting(source.taskTextColor, THEME_COLORS.dark.taskTextColor),
    pulseColor: getColorSetting(source.pulseColor, THEME_COLORS.dark.pulseColor),
  };
  const mode = source.themeMode;
  // C31's built-in modes kept the picked colours aside; the sets as they ship are what it showed.
  if (mode === "dark" || mode === "light" || mode === "system") {
    return { themeMode: mode, ...flatten("dark", THEME_COLORS.dark), ...flatten("light", THEME_COLORS.light) };
  }
  const tone: ThemeTone = isLightIsland(picked.islandBackgroundColor) ? "light" : "dark";
  const other: ThemeTone = tone === "dark" ? "light" : "dark";
  return { themeMode: tone, ...flatten(tone, picked), ...flatten(other, THEME_COLORS[other]) };
}

/** Whether a theme file or saved settings carry the two sets. */
export function hasThemeSets(source: Partial<Record<string, unknown>>) {
  return Object.values(THEME_COLOR_KEYS).some((keys) => Object.values(keys).some((key) => key in source));
}

function flatten(tone: ThemeTone, colors: ThemeColors): Partial<IslandSettings> {
  const keys = THEME_COLOR_KEYS[tone];
  return Object.fromEntries(COLOR_NAMES.map((name) => [keys[name], colors[name]]));
}
