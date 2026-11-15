import { defineSlot, type SettingsSectionMeta, type SlotHandle } from "../../../features/plugin-kernel/slots";
import type { SettingsCategory } from "../categories";

export function settingsSections<Props extends object, Category extends SettingsCategory>(): SlotHandle<Props, SettingsSectionMeta<Category>> {
  return defineSlot<Props, SettingsSectionMeta<Category>>("settings.section/v1");
}
