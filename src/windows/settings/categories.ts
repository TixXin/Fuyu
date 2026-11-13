import type { PlatformFeature } from "../../lib/platform.ts";
import { normalizeSearchText, searchWords } from "./settingsSearch.ts";

export const SETTINGS_CATEGORIES = [
  "overview",
  "general",
  "behavior",
  "behaviorTuck",
  "behaviorAlerts",
  "appearance",
  "theme",
  "themeMarket",
  "shortcuts",
  "shortcutsIsland",
  "todos",
  "calendar",
  "music",
  "musicLyrics",
  "musicLyricsStyle",
  "translation",
  "clipboard",
  "clipboardHistory",
  "clipboardSnippets",
  "clipboardData",
  "shelf",
  "screenshot",
  "screenshotRecord",
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
  { label: null, categories: ["overview"] },
  { label: "basics", categories: ["general", "behavior", "appearance", "shortcuts"] },
  { label: "features", categories: ["todos", "calendar", "music", "translation", "clipboard", "shelf", "screenshot", "messages"] },
  { label: null, categories: ["agents"] },
  { label: "extensions", categories: ["plugins", "market"] },
  { label: null, categories: ["about"] },
];

export const DEFAULT_SETTINGS_CATEGORY: SettingsCategory = "overview";

export type SettingsEntry = "behavior" | "appearance" | "shortcuts" | "music" | "clipboard" | "screenshot" | "agents";

export const SETTINGS_TABS: Readonly<Record<SettingsEntry, readonly TabbedCategory[]>> = {
  behavior: ["behavior", "behaviorTuck", "behaviorAlerts"],
  appearance: ["theme", "appearance", "themeMarket"],
  shortcuts: ["shortcuts", "shortcutsIsland"],
  music: ["music", "musicLyrics", "musicLyricsStyle"],
  clipboard: ["clipboard", "clipboardHistory", "clipboardSnippets", "clipboardData"],
  screenshot: ["screenshot", "screenshotRecord"],
  agents: ["agents", "agentSessions", "agentAlerts", "sounds", "agentApprovals", "agentConnect", "agentRemote"],
};

export type TabbedCategory = "music" | "musicLyrics" | "musicLyricsStyle" | "clipboard" | "clipboardHistory" | "clipboardSnippets" | "clipboardData" | "screenshot" | "screenshotRecord" | "behavior" | "behaviorTuck" | "behaviorAlerts" | "shortcuts" | "shortcutsIsland" | "theme" | "appearance" | "themeMarket" | "agents" | "agentSessions" | "agentAlerts" | "sounds" | "agentApprovals" | "agentConnect" | "agentRemote";

export function entryOf(category: SettingsCategory): SettingsEntry | null {
  return (Object.keys(SETTINGS_TABS) as SettingsEntry[]).find((entry) => (SETTINGS_TABS[entry] as readonly SettingsCategory[]).includes(category)) ?? null;
}

export function sidebarItemOf(category: SettingsCategory): SettingsCategory {
  return entryOf(category) ?? category;
}

export function isEntry(item: SettingsCategory): item is SettingsEntry {
  return item in SETTINGS_TABS;
}

export function entryPages(item: SettingsCategory): readonly SettingsCategory[] {
  return isEntry(item) ? SETTINGS_TABS[item] : [item];
}

export const SETTINGS_FEATURES = ["todos", "calendar", "music", "translation", "clipboard", "shelf", "screenshot", "agents"] as const;

export type SettingsFeature = (typeof SETTINGS_FEATURES)[number];

export const FEATURE_PAGES: Readonly<Record<SettingsFeature, readonly SettingsCategory[]>> = {
  todos: ["todos"],
  calendar: ["calendar"],
  music: ["music", "musicLyrics", "musicLyricsStyle"],
  translation: ["translation"],
  clipboard: ["clipboard", "clipboardHistory", "clipboardSnippets", "clipboardData"],
  shelf: ["shelf"],
  screenshot: ["screenshot", "screenshotRecord"],
  agents: ["agents", "agentSessions", "agentAlerts", "sounds", "agentApprovals", "agentConnect", "agentRemote"],
};

export function pagesOfFeaturesOff(on: Readonly<Record<SettingsFeature, boolean>>): ReadonlySet<SettingsCategory> {
  return new Set(SETTINGS_FEATURES.filter((feature) => !on[feature]).flatMap((feature) => FEATURE_PAGES[feature]));
}

const PAGE_FEATURES: Partial<Record<SettingsCategory, PlatformFeature>> = {
  music: "music",
  musicLyrics: "music",
  musicLyricsStyle: "music",
  translation: "translation",
  clipboard: "clipboard",
  clipboardHistory: "clipboard",
  clipboardSnippets: "clipboard",
  clipboardData: "clipboard",
  screenshot: "screenshot",
  screenshotRecord: "screenshot",
  agentConnect: "agentConnect",
  agentRemote: "agentRemote",
};

export function isCategoryAvailable(category: SettingsCategory, unsupported: ReadonlySet<PlatformFeature>, mac = false): boolean {
  if (mac && category === "screenshotRecord") return false;
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
