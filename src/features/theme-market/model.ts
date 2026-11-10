import { THEME_SETTING_KEYS, normalizeSettings, withThemeFrom } from "../appearance/settings.ts";
import { hasThemeSets, themeSetsFromSingleColors } from "../appearance/themeMode.ts";
import type { IslandSettings } from "../appearance/types";

type Text = { "zh-CN": string; en: string };

/** One theme of the market, checked: names, author and the theme fields it sets. */
export type MarketTheme = {
  id: string;
  name: Text;
  description: Text | null;
  author: string;
  /** Only theme fields (THEME_SETTING_KEYS); values are checked when applied. */
  appearance: Partial<Record<(typeof THEME_SETTING_KEYS)[number], unknown>>;
};

const MAX_TEXT = 160;

function readText(value: unknown, max: number): Text | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const pick = (locale: string) => (typeof record[locale] === "string" ? (record[locale] as string).trim().slice(0, max) : "");
  const zh = pick("zh-CN");
  const en = pick("en");
  return zh || en ? { "zh-CN": zh || en, en: en || zh } : null;
}

/** The market's entries that make sense, in their order; anything odd is left out. */
export function readMarketThemes(entries: readonly unknown[]): MarketTheme[] {
  const themes: MarketTheme[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" && /^[a-z0-9][a-z0-9.-]{2,63}$/.test(record.id) ? record.id : null;
    const name = readText(record.name, 40);
    const look = record.appearance;
    if (!id || seen.has(id) || !name || typeof look !== "object" || look === null) continue;
    const appearance = Object.fromEntries(THEME_SETTING_KEYS.filter((key) => key in look).map((key) => [key, (look as Record<string, unknown>)[key]]));
    if (Object.keys(appearance).length === 0) continue;
    seen.add(id);
    themes.push({
      id,
      name,
      description: readText(record.description, MAX_TEXT),
      author: typeof record.author === "string" ? record.author.slice(0, 39) : "",
      appearance,
    });
  }
  return themes;
}

/** `current` with the theme applied: only theme fields change, every value checked. */
export function withMarketTheme(current: IslandSettings, theme: MarketTheme): IslandSettings {
  // A theme from before the two colour sets (C33.3) puts its colours into the set they look like.
  const sets = hasThemeSets(theme.appearance) ? {} : themeSetsFromSingleColors({ ...current, themeMode: "custom", ...theme.appearance });
  return withThemeFrom(current, normalizeSettings({ ...current, ...theme.appearance, ...sets } as IslandSettings));
}

/** Whether `current` already looks like the theme. */
export function isThemeInUse(current: IslandSettings, theme: MarketTheme) {
  const applied = withMarketTheme(current, theme);
  // The three single colours are only a copy of the set in use (C33.3), so they are not compared.
  const copies = new Set<string>(["islandBackgroundColor", "taskTextColor", "pulseColor"]);
  return THEME_SETTING_KEYS.every((key) => copies.has(key) || applied[key] === current[key]);
}
