import { CollapsedItemsSection } from "./sections/CollapsedItemsSection";
import { DisplaySettingsSection } from "./sections/DisplaySettingsSection";
import { IslandPreview } from "../../components/island-preview/IslandPreview";
import { SizeSettingsSection } from "./sections/LayoutSettingsSection";
import type { IslandSettings } from "../../lib/settings/types";
import { requestPanelPreview } from "./storage";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

type AppearanceSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

function SizeSection({ settings, onSettingsChange }: AppearanceSectionProps) {
  return (
    <SizeSettingsSection
      settings={settings}
      onSettingsChange={onSettingsChange}
      onPreviewIsland={(expanded) => requestPanelPreview(expanded ? "expanded" : "collapsed")}
    />
  );
}

const sections = settingsSections<AppearanceSectionProps, "appearance">();

sections.add({ id: "appearance.size", category: "appearance", order: 10, component: SizeSection });
sections.add({ id: "appearance.display", category: "appearance", order: 20, component: DisplaySettingsSection });
sections.add({ id: "appearance.collapsed-items", category: "appearance", order: 30, component: CollapsedItemsSection });

export function AppearanceSettingsPage(props: AppearanceSectionProps) {
  return (
    <>
      <IslandPreview settings={props.settings} />
      <SlotView slot={sections} group="appearance" props={props} />
    </>
  );
}
