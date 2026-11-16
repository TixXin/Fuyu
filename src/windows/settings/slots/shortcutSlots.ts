import type { SettingsCategory } from "../categories";
import type { IslandSettings } from "../../../lib/settings/types";
import { defineSlot, type SettingsSectionMeta } from "../../../features/plugin-kernel/slots";
import type { TakenBy } from "../ShortcutFeatureOffRow";
import { settingsSections } from "./sectionSlot";

export type ShortcutsSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPage: (page: SettingsCategory) => void;
  takenBy: TakenBy;
  refreshPlugins: () => void;
};

export const shortcutSections = settingsSections<ShortcutsSectionProps, "shortcuts" | "shortcutsIsland">();
export const shortcutReferences = defineSlot<ShortcutsSectionProps, SettingsSectionMeta<"shortcutsReference">>("settings.section/v1");
