import type { SettingsSectionMeta, SlotHandle } from "../../../features/plugin-kernel/slots";
import { settingsSections as anySettingsSections } from "../../../features/plugin-kernel/settingsSlots";
import type { SettingsCategory } from "../categories";

export function settingsSections<Props extends object, Category extends SettingsCategory>(): SlotHandle<Props, SettingsSectionMeta<Category>> {
  return anySettingsSections<Props, Category>();
}
