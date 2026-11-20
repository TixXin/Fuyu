import type { IslandSettings } from "../../lib/settings/types.ts";
import type { ShortcutTakenBy } from "../../lib/shortcut/conflicts.ts";
import { defineSlot, type SettingsSectionMeta, type SlotHandle } from "./slots.ts";

export interface SettingsRunnerProps {
  settings: IslandSettings;
}

export interface ShortcutsSectionProps {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
  onOpenPage(page: string): void;
  takenBy: ShortcutTakenBy;
  refreshPlugins(): void;
}

export function settingsSections<Props extends object, Category extends string>(): SlotHandle<Props, SettingsSectionMeta<Category>> {
  return defineSlot<Props, SettingsSectionMeta<Category>>("settings.section/v1");
}

export interface IslandItemStyleProps {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
}

export const ISLAND_ITEM_STYLE_PREFIX = "islandLayout.item.";

export function islandItemStyleId(item: string, part?: string): string {
  return `${ISLAND_ITEM_STYLE_PREFIX}${item}${part ? `#${part}` : ""}`;
}

export function islandItemStyleMatches(id: string, item: string): boolean {
  if (!id.startsWith(ISLAND_ITEM_STYLE_PREFIX)) return false;
  const key = id.slice(ISLAND_ITEM_STYLE_PREFIX.length).split("#")[0];
  return key === item || (key.endsWith(":") && item.startsWith(key));
}

export interface IslandPlacementLinkProps {
  item: string;
  title?: string;
}

export const settingsRunners = defineSlot<SettingsRunnerProps>("settings.runner/v1");
export const shortcutSections = settingsSections<ShortcutsSectionProps, "shortcuts" | "shortcutsIsland">();
export const islandItemStyles = settingsSections<IslandItemStyleProps, "islandLayout">();
export const islandPlacementLinks = settingsSections<IslandPlacementLinkProps, "islandPlacementLink">();
export const shortcutReferences = settingsSections<ShortcutsSectionProps, "shortcutsReference">();
