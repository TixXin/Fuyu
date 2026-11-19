import { defineSlot } from "../../../features/plugin-kernel/slots.ts";
import type { CategoryMeta, SettingsCategory, SettingsLink } from "../../../features/plugin-kernel/settingsCategories.ts";
import type { Dispatch, SetStateAction } from "react";
import type { PlatformFeature } from "../../../lib/platform.ts";
import type { IslandSettings } from "../../../lib/settings/types.ts";
import type { useSettingPresets } from "../../../lib/settings/useSettingPresets.ts";
import type { LocaleCode } from "../../../i18n/index.ts";
import type { FeatureSwitches } from "../useFeatureSwitches.ts";

export { addSettingsCategory, BUILTIN_CATEGORIES } from "../../../features/plugin-kernel/settingsCategories.ts";
export type { CategoryContext, CategoryMeta, SettingsCategory, SettingsLink, SettingsEntry, SettingsFeature, SettingsGroup, TabbedCategory } from "../../../features/plugin-kernel/settingsCategories.ts";

export interface SettingsPageProps {
  settings: IslandSettings;
  locale: LocaleCode;
  unsupported: ReadonlySet<PlatformFeature>;
  features: FeatureSwitches;
  presets: ReturnType<typeof useSettingPresets>;
  onLocaleChange: (locale: LocaleCode) => void;
  onSettingsChange: Dispatch<SetStateAction<IslandSettings>>;
  onOpenPage: (page: SettingsLink) => void;
  onShowPage: (page: SettingsCategory) => void;
  onOpenShortcuts: () => void;
}

export const categorySlot = defineSlot<SettingsPageProps, CategoryMeta>("settings.category/v1");
