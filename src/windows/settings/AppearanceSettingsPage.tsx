import { CollapsedItemsSection } from "../../features/appearance/CollapsedItemsSection";
import { DisplaySettingsSection } from "../../features/appearance/DisplaySettingsSection";
import { IslandPreview } from "../../features/appearance/IslandPreview";
import { SizeSettingsSection } from "../../features/appearance/LayoutSettingsSection";
import type { IslandSettings } from "../../features/appearance/types";
import { requestPanelPreview } from "./storage";

/** Settings → Appearance: how big the island is and what the collapsed bar shows. The look is on Theme. */
export function AppearanceSettingsPage({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  return (
    <>
      <IslandPreview settings={settings} />
      <SizeSettingsSection
        settings={settings}
        onSettingsChange={onSettingsChange}
        onPreviewIsland={(expanded) => requestPanelPreview(expanded ? "expanded" : "collapsed")}
      />
      <DisplaySettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <CollapsedItemsSection />
    </>
  );
}
