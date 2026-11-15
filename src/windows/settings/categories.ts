import type { PlatformFeature } from "../../lib/platform.ts";
import { normalizeSearchText, searchWords } from "./settingsSearch.ts";
import { BUILTIN_CATEGORIES, categorySlot, type SettingsCategory, type SettingsEntry, type SettingsFeature, type SettingsGroup, type TabbedCategory } from "./slots/categorySlot.ts";

export type { SettingsCategory, SettingsEntry, SettingsFeature, SettingsGroup, TabbedCategory };

type Category = ReturnType<typeof categorySlot.items>[number];
type Categories = readonly Category[];

export interface SettingsGroupRow {
  label: SettingsGroup | null;
  categories: SettingsCategory[];
}

export const DEFAULT_SETTINGS_CATEGORY: SettingsCategory = "overview";

const registered = (): Categories => categorySlot.items();
const idOf = (item: Category) => item.id as SettingsCategory;
const find = (category: string) => registered().find((item) => item.id === category);
const entryIn = (category: SettingsCategory, items: Categories) => items.find((item) => item.tabs?.includes(category));

export function settingsCategories(items = registered()): SettingsCategory[] {
  return items.map(idOf);
}

export function entryOf(category: SettingsCategory): SettingsEntry | null {
  const entry = entryIn(category, registered());
  return entry ? (entry.id as SettingsEntry) : null;
}

export function sidebarItemOf(category: SettingsCategory): SettingsCategory {
  return entryOf(category) ?? category;
}

export function isEntry(item: SettingsCategory): item is SettingsEntry {
  return find(item)?.tabs !== undefined;
}

export function entryTabs(entry: SettingsEntry): readonly TabbedCategory[] {
  return (find(entry)?.tabs ?? []) as readonly TabbedCategory[];
}

export function entryPages(item: SettingsCategory): readonly SettingsCategory[] {
  return isEntry(item) ? entryTabs(item) : [item];
}

export function settingsGroups(items = registered()): SettingsGroupRow[] {
  const groups: SettingsGroupRow[] = [];
  for (const item of items) {
    const id = idOf(item);
    const entry = entryIn(id, items);
    if (entry && entry.id !== id) continue;
    const label = item.group ?? null;
    const last = groups[groups.length - 1];
    const group = label === null ? (last?.label === null ? last : undefined) : groups.find((other) => other.label === label);
    if (group) group.categories.push(id);
    else groups.push({ label, categories: [id] });
  }
  return groups;
}

export function featureOf(category: SettingsCategory): SettingsFeature | undefined {
  return find(category)?.feature as SettingsFeature | undefined;
}

export function pagesOfFeaturesOff(on: Readonly<Record<SettingsFeature, boolean>>, items = registered()): ReadonlySet<SettingsCategory> {
  const off = (feature: string | undefined) => feature !== undefined && feature in on && !on[feature as SettingsFeature];
  return new Set(items.filter((item) => off(item.feature)).map(idOf));
}

export function isCategoryAvailable(category: SettingsCategory, unsupported: ReadonlySet<PlatformFeature>, mac = false, pluginsV3 = false): boolean {
  return find(category)?.available?.({ unsupported, mac, pluginsV3 }) ?? true;
}

export function searchCategories(query: string, describe: (category: SettingsCategory) => string): SettingsCategory[] {
  const categories = settingsCategories();
  const words = searchWords(query);
  if (words.length === 0) return categories;
  return categories.filter((category) => {
    const text = normalizeSearchText(describe(category));
    return words.every((word) => text.includes(word));
  });
}

export function settingsCategoryFor(name: string): SettingsCategory | null {
  const item = find(name) ?? registered().find((other) => other.aliases?.includes(name));
  return item ? idOf(item) : null;
}

export const SETTINGS_FEATURES: readonly SettingsFeature[] = [...new Set(BUILTIN_CATEGORIES.flatMap((item) => ("feature" in item ? [item.feature] : [])))];

const builtinPages = (feature: SettingsFeature): readonly SettingsCategory[] => BUILTIN_CATEGORIES.filter((item) => "feature" in item && item.feature === feature).map((item) => item.id);

export const FEATURE_PAGES = Object.fromEntries(SETTINGS_FEATURES.map((feature) => [feature, builtinPages(feature)])) as Readonly<Record<SettingsFeature, readonly SettingsCategory[]>>;
