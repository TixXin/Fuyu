import { settingsSections } from "../../features/plugin-kernel/settingsSlots";
import type { SettingsSectionMeta, SlotEntry } from "../../features/plugin-kernel/slots";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";

type Section = SlotEntry<object, SettingsSectionMeta>;

const sections = settingsSections<object, string>();
const ownedBy = (pluginId: string) => (items: readonly Section[]) => items.filter((item) => item.external && item.owner === pluginId);

export function PluginSettingsSections({ pluginId }: { pluginId: string }) {
  const mine = ownedBy(pluginId)(useSlotEntries(sections));
  if (mine.length === 0) return null;
  return (
    <div className="plugin-detail__sections" data-plugin-sections={pluginId}>
      <SlotView slot={sections} select={ownedBy(pluginId)} />
    </div>
  );
}
