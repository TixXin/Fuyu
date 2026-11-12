import { THEME_SETTING_KEYS, normalizeSettings, withThemeFrom } from "./settings.ts";
import { hasThemeSets, themeColors, themeSetsFromSingleColors } from "./themeMode.ts";
import type { IslandSettings } from "./types";

export const MAX_THEME_NAME_LENGTH = 60;

type ThemeKey = (typeof THEME_SETTING_KEYS)[number];

const APP_NAMES = ["fuyu", "fly-island"];

export type ThemeFile = {
  app: "fuyu";
  kind: "theme";
  version: 1;
  name: string;
  exportedAt: string;
  appearance: Pick<IslandSettings, ThemeKey>;
};

export type ThemeProblem = "notJson" | "notTheme" | "newerVersion";

export function buildTheme(name: string, settings: IslandSettings, now: Date): ThemeFile {
  const shown = { ...settings, ...themeColors(settings, settings.themeMode === "light" ? "light" : "dark") };
  const appearance = Object.fromEntries(
    THEME_SETTING_KEYS.map((key) => [key, shown[key]]),
  ) as ThemeFile["appearance"];
  return { app: "fuyu", kind: "theme", version: 1, name, exportedAt: now.toISOString(), appearance };
}

export function themeFileName(now: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `fuyu-theme-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

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
  const sets = hasThemeSets(picked) ? {} : themeSetsFromSingleColors({ ...current, themeMode: "custom", ...picked });
  const settings = withThemeFrom(current, normalizeSettings({ ...current, ...picked, ...sets }));
  const name = typeof file.name === "string" ? file.name.trim().slice(0, MAX_THEME_NAME_LENGTH) : "";
  return { name, settings };
}
