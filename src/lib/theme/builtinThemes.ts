import { activeTone, themeColors, withThemeColors, type ThemeColors, type ThemeTone } from "./themeMode.ts";
import type { IslandSettings } from "../settings/types";

export const BUILTIN_THEME_IDS = ["greyWhite", "frostedClear", "frostedWarm"] as const;

export type BuiltinThemeId = (typeof BUILTIN_THEME_IDS)[number];

export type BuiltinTheme = { opacity: number } & Record<ThemeTone, ThemeColors>;

export const BUILTIN_THEMES: Record<BuiltinThemeId, BuiltinTheme> = {
  greyWhite: {
    opacity: 100,
    light: { islandBackgroundColor: "#e4e5e9", taskTextColor: "#1c1c21", pulseColor: "#1f9d55", inkColor: "" },
    dark: { islandBackgroundColor: "#1d1e22", taskTextColor: "#ececf0", pulseColor: "#3ae489", inkColor: "" },
  },
  frostedClear: {
    opacity: 86,
    light: { islandBackgroundColor: "#fafbfd", taskTextColor: "#16171c", pulseColor: "#16904c", inkColor: "" },
    dark: { islandBackgroundColor: "#15161a", taskTextColor: "#f4f5f8", pulseColor: "#3ae489", inkColor: "" },
  },
  frostedWarm: {
    opacity: 90,
    light: { islandBackgroundColor: "#f7f1e6", taskTextColor: "#2a2118", pulseColor: "#2f8f4e", inkColor: "#2a2118" },
    dark: { islandBackgroundColor: "#1f1b17", taskTextColor: "#f5ecdc", pulseColor: "#7fdc8c", inkColor: "" },
  },
};

export function withBuiltinTheme(settings: IslandSettings, id: BuiltinThemeId): IslandSettings {
  const theme = BUILTIN_THEMES[id];
  const colored = withThemeColors(withThemeColors(settings, "light", theme.light), "dark", theme.dark);
  return {
    ...colored,
    appearanceMode: "classic",
    opacity: theme.opacity,
    themeMode: settings.themeMode === "dark" ? "light" : settings.themeMode,
  };
}

export function builtinThemeInUse(settings: IslandSettings): BuiltinThemeId | null {
  if (settings.appearanceMode !== "classic") return null;
  return BUILTIN_THEME_IDS.find((id) => {
    const theme = BUILTIN_THEMES[id];
    if (theme.opacity !== settings.opacity) return false;
    return (["light", "dark"] as const).every((tone) => sameColors(themeColors(settings, tone), theme[tone]));
  }) ?? null;
}

export function builtinThemeColors(id: BuiltinThemeId, settings: IslandSettings, systemDark: boolean): ThemeColors {
  return BUILTIN_THEMES[id][activeTone(settings.themeMode === "dark" ? "light" : settings.themeMode, systemDark)];
}

function sameColors(a: ThemeColors, b: ThemeColors) {
  return (Object.keys(b) as (keyof ThemeColors)[]).every((key) => a[key].toLowerCase() === b[key].toLowerCase());
}
