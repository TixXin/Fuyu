import { getColorSetting, inkOn, isLightIsland } from "../../utils/color.ts";
import type { IslandSettings, ThemeMode } from "./types";

export const THEME_MODES = ["dark", "light", "system"] as const satisfies readonly ThemeMode[];

export type ThemeTone = "dark" | "light";

export type ThemeColors = Pick<IslandSettings, "islandBackgroundColor" | "taskTextColor" | "pulseColor">;

export const THEME_COLORS: Record<ThemeTone, ThemeColors> = {
  dark: { islandBackgroundColor: "#000000", taskTextColor: "#ffffff", pulseColor: "#3ae489" },
  light: { islandBackgroundColor: "#f2f2f5", taskTextColor: "#1c1c1f", pulseColor: "#1f9d55" },
};

export const THEME_COLOR_KEYS = {
  dark: { islandBackgroundColor: "darkBackgroundColor", taskTextColor: "darkTextColor", pulseColor: "darkPulseColor" },
  light: { islandBackgroundColor: "lightBackgroundColor", taskTextColor: "lightTextColor", pulseColor: "lightPulseColor" },
} as const satisfies Record<ThemeTone, Record<keyof ThemeColors, keyof IslandSettings>>;

const COLOR_NAMES = ["islandBackgroundColor", "taskTextColor", "pulseColor"] as const;

export function activeTone(mode: ThemeMode, systemDark: boolean): ThemeTone {
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

export function themeColors(settings: IslandSettings, tone: ThemeTone): ThemeColors {
  const keys = THEME_COLOR_KEYS[tone];
  return {
    islandBackgroundColor: settings[keys.islandBackgroundColor],
    taskTextColor: settings[keys.taskTextColor],
    pulseColor: settings[keys.pulseColor],
  };
}

export function withThemeColors(settings: IslandSettings, tone: ThemeTone, colors: ThemeColors): IslandSettings {
  const keys = THEME_COLOR_KEYS[tone];
  return {
    ...settings,
    [keys.islandBackgroundColor]: colors.islandBackgroundColor,
    [keys.taskTextColor]: colors.taskTextColor,
    [keys.pulseColor]: colors.pulseColor,
  };
}

export function resolveThemeColors(settings: IslandSettings, systemDark: boolean, tone = activeTone(settings.themeMode, systemDark)): IslandSettings {
  return { ...settings, ...themeColors(settings, tone) };
}

export const DARK_SURFACES = ["collapsed", "panel", "windows"] as const;

export type DarkSurface = (typeof DARK_SURFACES)[number];

export const DARK_SURFACE_KEYS = { collapsed: "collapsedDark", panel: "panelDark", windows: "windowsDark" } as const satisfies Record<DarkSurface, keyof IslandSettings>;

export function surfaceThemeColors(settings: IslandSettings, surface: DarkSurface): IslandSettings {
  return settings[DARK_SURFACE_KEYS[surface]] && isLightIsland(settings.islandBackgroundColor) ? { ...settings, ...themeColors(settings, "dark") } : settings;
}

export function surfaceTone(settings: Pick<IslandSettings, "themeMode" | "collapsedDark" | "panelDark" | "windowsDark">, systemDark: boolean, surface: DarkSurface): ThemeTone {
  return settings[DARK_SURFACE_KEYS[surface]] ? "dark" : activeTone(settings.themeMode, systemDark);
}

export function themeSetsFromSingleColors(source: Partial<Record<string, unknown>>): Partial<IslandSettings> {
  const picked: ThemeColors = {
    islandBackgroundColor: getColorSetting(source.islandBackgroundColor, THEME_COLORS.dark.islandBackgroundColor),
    taskTextColor: getColorSetting(source.taskTextColor, THEME_COLORS.dark.taskTextColor),
    pulseColor: getColorSetting(source.pulseColor, THEME_COLORS.dark.pulseColor),
  };
  const mode = source.themeMode;
  if (mode === "dark" || mode === "light" || mode === "system") {
    return { themeMode: mode, ...flatten("dark", THEME_COLORS.dark), ...flatten("light", THEME_COLORS.light) };
  }
  const tone: ThemeTone = isLightIsland(picked.islandBackgroundColor) ? "light" : "dark";
  const other: ThemeTone = tone === "dark" ? "light" : "dark";
  return { themeMode: tone, ...flatten(tone, picked), ...flatten(other, THEME_COLORS[other]) };
}

export function hasThemeSets(source: Partial<Record<string, unknown>>) {
  return Object.values(THEME_COLOR_KEYS).some((keys) => Object.values(keys).some((key) => key in source));
}

function flatten(tone: ThemeTone, colors: ThemeColors): Partial<IslandSettings> {
  const keys = THEME_COLOR_KEYS[tone];
  return Object.fromEntries(COLOR_NAMES.map((name) => [keys[name], colors[name]]));
}

export function accentVariables(accent: string | null): Record<string, string> {
  if (!accent) return {};
  const [red, green, blue] = [1, 3, 5].map((start) => Number.parseInt(accent.slice(start, start + 2), 16));
  return {
    "--color-accent": accent,
    "--color-focus-ring": `rgba(${red}, ${green}, ${blue}, 0.88)`,
    "--color-focus-ring-soft": `rgba(${red}, ${green}, ${blue}, 0.72)`,
    "--color-on-accent": `rgb(${inkOn(accent)})`,
  };
}
