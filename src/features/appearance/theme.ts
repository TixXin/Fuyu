// Appearance theme files: one style preset as a file, to share or move to another computer.
// Pure; useSettingPresets saves the file and turns an imported one into a preset.

import { THEME_SETTING_KEYS, normalizeSettings, withThemeFrom } from "./settings.ts";
import { hasThemeSets, themeColors, themeSetsFromSingleColors } from "./themeMode.ts";
import type { IslandSettings } from "./types";

/** Longer names are cut; the preset list shows one line anyway. */
export const MAX_THEME_NAME_LENGTH = 60;

type ThemeKey = (typeof THEME_SETTING_KEYS)[number];

/** Theme files written before the rename (D17) say "fly-island". */
const APP_NAMES = ["fuyu", "fly-island"];

export type ThemeFile = {
  app: "fuyu";
  kind: "theme";
  version: 1;
  name: string;
  exportedAt: string;
  /** The look only (THEME_SETTING_KEYS). Files written before C26 also carry sizes, which are ignored. */
  appearance: Pick<IslandSettings, ThemeKey>;
};

export type ThemeProblem = "notJson" | "notTheme" | "newerVersion";

/** The theme file of a preset: its name and its look, nothing else. */
export function buildTheme(name: string, settings: IslandSettings, now: Date): ThemeFile {
  // The single colours copy the set the mode uses (dark for "system"): islands from before the two
  // sets (C33.3) read only those.
  const shown = { ...settings, ...themeColors(settings, settings.themeMode === "light" ? "light" : "dark") };
  const appearance = Object.fromEntries(
    THEME_SETTING_KEYS.map((key) => [key, shown[key]]),
  ) as ThemeFile["appearance"];
  return { app: "fuyu", kind: "theme", version: 1, name, exportedAt: now.toISOString(), appearance };
}

/** "fuyu-theme-2026-11-08-1430.json", in local time; the preset's name is inside. */
export function themeFileName(now: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `fuyu-theme-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/**
 * The name and settings of a theme file's text, or why it cannot be imported. Only the theme
 * fields are read (sizes in older files are left alone), over `current`, and every value goes through normalizeSettings, so a file
 * edited by hand cannot carry anything the appearance page would not allow.
 */
export function parseTheme(
  text: string,
  current: IslandSettings,
): { name: string; settings: IslandSettings } | { problem: ThemeProblem } {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return { problem: "notJson" };
  }
  if (typeof value !== "object" || value === null) return { problem: "notTheme" };
  const file = value as Record<string, unknown>;
  if (typeof file.app !== "string" || !APP_NAMES.includes(file.app) || file.kind !== "theme" || typeof file.appearance !== "object" || file.appearance === null) {
    return { problem: "notTheme" };
  }
  if (typeof file.version !== "number" || file.version > 1) return { problem: "newerVersion" };
  const source = file.appearance as Record<string, unknown>;
  const picked = Object.fromEntries(
    THEME_SETTING_KEYS.filter((key) => key in source).map((key) => [key, source[key]]),
  );
  // A file from before the two colour sets (C33.3) puts its colours into the set they look like.
  const sets = hasThemeSets(picked) ? {} : themeSetsFromSingleColors({ ...current, themeMode: "custom", ...picked });
  const settings = withThemeFrom(current, normalizeSettings({ ...current, ...picked, ...sets }));
  const name = typeof file.name === "string" ? file.name.trim().slice(0, MAX_THEME_NAME_LENGTH) : "";
  return { name, settings };
}
