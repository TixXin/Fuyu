import { CollapsedItemsSection } from "../../features/appearance/CollapsedItemsSection";
import { DisplaySettingsSection } from "../../features/appearance/DisplaySettingsSection";
import { IslandPreview } from "../../features/appearance/IslandPreview";
import { SizeSettingsSection } from "../../features/appearance/LayoutSettingsSection";
import type { IslandSettings } from "../../features/appearance/types";
import { requestPanelPreview } from "./storage";

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

export function AppearanceSettingsPage(props: AppearanceSectionProps) {
  const { settings, onSettingsChange } = props;
  return (
    <>
      <IslandPreview settings={settings} />
      <SizeSection {...props} />
      <DisplaySettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <CollapsedItemsSection />
    </>
  );
}
