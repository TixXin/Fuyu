import type { PlatformFeature } from "../../lib/platform.ts";
import { normalizeSearchText, searchWords } from "./settingsSearch.ts";
import { BUILTIN_CATEGORIES, type CategoryMeta, type SettingsCategory, type SettingsEntry, type SettingsFeature, type SettingsGroup, type TabbedCategory } from "./slots/categorySlot.ts";

export type { SettingsCategory, SettingsEntry, SettingsFeature, SettingsGroup, TabbedCategory };

const ITEMS: readonly (CategoryMeta & { id: SettingsCategory })[] = BUILTIN_CATEGORIES;

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = ITEMS.map((item) => item.id);

function groupsOf(): { label: SettingsGroup | null; categories: SettingsCategory[] }[] {
  const groups: { label: SettingsGroup | null; categories: SettingsCategory[] }[] = [];
  for (const item of ITEMS) {
    if (sidebarItemOf(item.id) !== item.id) continue;
    const label = item.group ?? null;
    const last = groups[groups.length - 1];
    const group = label === null ? (last?.label === null ? last : undefined) : groups.find((other) => other.label === label);
    if (group) group.categories.push(item.id);
    else groups.push({ label, categories: [item.id] });
  }
  return groups;
}

export const DEFAULT_SETTINGS_CATEGORY: SettingsCategory = "overview";

export const SETTINGS_TABS = Object.fromEntries(ITEMS.filter((item) => item.tabs !== undefined).map((item) => [item.id, item.tabs])) as Readonly<Record<SettingsEntry, readonly TabbedCategory[]>>;

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

export const SETTINGS_GROUPS: readonly { label: SettingsGroup | null; categories: readonly SettingsCategory[] }[] = groupsOf();

export const SETTINGS_FEATURES: readonly SettingsFeature[] = [...new Set(BUILTIN_CATEGORIES.flatMap((item) => ("feature" in item ? [item.feature] : [])))];

const pagesOf = (feature: SettingsFeature): readonly SettingsCategory[] => ITEMS.filter((item) => item.feature === feature).map((item) => item.id);

export const FEATURE_PAGES = Object.fromEntries(SETTINGS_FEATURES.map((feature) => [feature, pagesOf(feature)])) as Readonly<Record<SettingsFeature, readonly SettingsCategory[]>>;

export function pagesOfFeaturesOff(on: Readonly<Record<SettingsFeature, boolean>>): ReadonlySet<SettingsCategory> {
  return new Set(SETTINGS_FEATURES.filter((feature) => !on[feature]).flatMap((feature) => FEATURE_PAGES[feature]));
}

export function isCategoryAvailable(category: SettingsCategory, unsupported: ReadonlySet<PlatformFeature>, mac = false, pluginsV3 = false): boolean {
  return ITEMS.find((item) => item.id === category)?.available?.({ unsupported, mac, pluginsV3 }) ?? true;
}

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
  return ITEMS.find((item) => item.aliases?.includes(name))?.id ?? null;
}
