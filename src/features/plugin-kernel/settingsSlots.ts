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

export const settingsRunners = defineSlot<SettingsRunnerProps>("settings.runner/v1");
export const shortcutSections = settingsSections<ShortcutsSectionProps, "shortcuts" | "shortcutsIsland">();
export const shortcutReferences = settingsSections<ShortcutsSectionProps, "shortcutsReference">();
