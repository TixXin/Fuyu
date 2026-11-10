import { ColorSettingsSection } from "../../features/appearance/ColorSettingsSection";
import { IslandPreview } from "../../features/appearance/IslandPreview";
import { CornerSettingsSection } from "../../features/appearance/LayoutSettingsSection";
import { PresetSettingsSection } from "../../features/appearance/PresetSettingsSection";
import { StyleSettingsSection } from "../../features/appearance/StyleSettingsSection";
import { ThemeModeSection } from "../../features/appearance/ThemeModeSection";
import { useResolvedTheme } from "../../features/appearance/useResolvedTheme";
import type { IslandSettings } from "../../features/appearance/types";
import type { useSettingPresets } from "../../features/appearance/useSettingPresets";
import { requestPanelPreview } from "./storage";

/**
 * Settings → Theme: dark, light or system colours (C31), then what the island looks like (style,
 * colours, corners) and the saved themes. The preview and the colour rows show the colours the
 * island uses; picking one by hand switches to the custom colours.
 */
export function ThemeSettingsPage({
  settings,
  presets,
  onSettingsChange,
}: {
  settings: IslandSettings;
  presets: ReturnType<typeof useSettingPresets>;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const [shown, change] = useResolvedTheme(settings, onSettingsChange);
  return (
    <>
      <IslandPreview settings={shown} />
      <ThemeModeSection settings={settings} onSettingsChange={onSettingsChange} />
      <StyleSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <ColorSettingsSection
        settings={shown}
        onSettingsChange={(next) => change({ ...next, themeMode: "custom" })}
      />
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
