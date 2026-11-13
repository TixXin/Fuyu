import type { PlatformFeature } from "../../lib/platform.ts";
import { normalizeSearchText, searchWords } from "./settingsSearch.ts";

export const SETTINGS_CATEGORIES = [
  "general",
  "behavior",
  "appearance",
  "theme",
  "themeMarket",
  "shortcuts",
  "todos",
  "calendar",
  "music",
  "translation",
  "clipboard",
  "shelf",
  "screenshot",
  "messages",
  "agents",
  "agentSessions",
  "agentAlerts",
  "sounds",
  "agentApprovals",
  "agentConnect",
  "agentRemote",
  "plugins",
  "market",
  "about",
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

export type SettingsGroup = "basics" | "features" | "agents" | "extensions";

export const SETTINGS_GROUPS: readonly { label: SettingsGroup | null; categories: readonly SettingsCategory[] }[] = [
  { label: "basics", categories: ["general", "behavior", "appearance", "theme", "themeMarket", "shortcuts"] },
  { label: "features", categories: ["todos", "calendar", "music", "translation", "clipboard", "shelf", "screenshot", "messages"] },
  { label: "agents", categories: ["agents", "agentSessions", "agentAlerts", "sounds", "agentApprovals", "agentConnect", "agentRemote"] },
  { label: "extensions", categories: ["plugins", "market"] },
  { label: null, categories: ["about"] },
];

export const DEFAULT_SETTINGS_CATEGORY: SettingsCategory = "general";

const PAGE_FEATURES: Partial<Record<SettingsCategory, PlatformFeature>> = {
  music: "music",
  translation: "translation",
  clipboard: "clipboard",
  screenshot: "screenshot",
  agentConnect: "agentConnect",
  agentRemote: "agentRemote",
};

export function isCategoryAvailable(category: SettingsCategory, unsupported: ReadonlySet<PlatformFeature>): boolean {
  const feature = PAGE_FEATURES[category];
  return feature === undefined || !unsupported.has(feature);
}

const MERGED_CATEGORIES: Readonly<Record<string, SettingsCategory>> = {
  qq: "messages",
  wechat: "messages",
  mail: "messages",
  updates: "about",
};

export function searchCategories(query: string, describe: (category: SettingsCategory) => string): SettingsCategory[] {
  const words = searchWords(query);
  if (words.length === 0) return [...SETTINGS_CATEGORIES];
  return SETTINGS_CATEGORIES.filter((category) => {
    const text = normalizeSearchText(describe(category));
    return words.every((word) => text.includes(word));
  });
}

export function settingsCategoryFor(name: string): SettingsCategory | null {
  if ((SETTINGS_CATEGORIES as readonly string[]).includes(name)) return name as SettingsCategory;
  return MERGED_CATEGORIES[name] ?? null;
}
