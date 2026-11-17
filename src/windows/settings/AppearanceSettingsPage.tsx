import { CollapsedItemsSection } from "./sections/CollapsedItemsSection";
import { DisplaySettingsSection } from "./sections/DisplaySettingsSection";
import { IslandPreview } from "../../components/island-preview/IslandPreview";
import { SizeSettingsSection } from "./sections/LayoutSettingsSection";
import { PositionSettingsSection } from "./sections/PositionSettingsSection";
import type { IslandSettings } from "../../lib/settings/types";
import { requestIslandPositionReset, requestPanelPreview } from "./storage";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

export type AppearanceTab = "appearance" | "appearanceCollapsed";

type AppearanceSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

function PositionSection({ settings, onSettingsChange }: AppearanceSectionProps) {
  return (
    <PositionSettingsSection
      settings={settings}
      onSettingsChange={onSettingsChange}
      onResetPosition={requestIslandPositionReset}
    />
  );
}

function SizeSection({ settings, onSettingsChange }: AppearanceSectionProps) {
  return (
    <SizeSettingsSection
      settings={settings}
      onSettingsChange={onSettingsChange}
      onPreviewIsland={(expanded) => requestPanelPreview(expanded ? "expanded" : "collapsed")}
    />
  );
}

const sections = settingsSections<AppearanceSectionProps, AppearanceTab>();

sections.add({ id: "appearance.position", category: "appearance", order: 5, component: PositionSection });
sections.add({ id: "appearance.size", category: "appearance", order: 10, component: SizeSection });
sections.add({ id: "appearanceCollapsed.display", category: "appearanceCollapsed", order: 20, component: DisplaySettingsSection });
sections.add({ id: "appearanceCollapsed.collapsed-items", category: "appearanceCollapsed", order: 30, component: CollapsedItemsSection });

export function AppearanceSettingsPage({ tab, ...props }: AppearanceSectionProps & { tab: AppearanceTab }) {
  return (
    <>
      <IslandPreview settings={props.settings} />
      <SlotView slot={sections} group={tab} props={props} />
    </>
  );
}
