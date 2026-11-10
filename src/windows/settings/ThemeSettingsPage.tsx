import { ColorSettingsSection } from "../../features/appearance/ColorSettingsSection";
import { IslandPreview } from "../../features/appearance/IslandPreview";
import { CornerSettingsSection } from "../../features/appearance/LayoutSettingsSection";
import { PresetSettingsSection } from "../../features/appearance/PresetSettingsSection";
import { StyleSettingsSection } from "../../features/appearance/StyleSettingsSection";
import type { IslandSettings } from "../../features/appearance/types";
import type { useSettingPresets } from "../../features/appearance/useSettingPresets";
import { requestPanelPreview } from "./storage";

/** Settings → Theme: what the island looks like (style, colours, corners) and the saved themes. */
export function ThemeSettingsPage({
  settings,
  presets,
  onSettingsChange,
}: {
  settings: IslandSettings;
  presets: ReturnType<typeof useSettingPresets>;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  return (
    <>
      <IslandPreview settings={settings} />
      <StyleSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <ColorSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <CornerSettingsSection
        settings={settings}
        onSettingsChange={onSettingsChange}
        onPreviewIsland={(expanded) => requestPanelPreview(expanded ? "expanded" : "collapsed")}
      />
      {/* Last: saving the look you just tuned, or going back to one saved before. */}
      <PresetSettingsSection {...presets} />
    </>
  );
}
