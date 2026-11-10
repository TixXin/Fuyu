import { useState } from "react";
import { ColorSettingsSection } from "../../features/appearance/ColorSettingsSection";
import { IslandPreview } from "../../features/appearance/IslandPreview";
import { CornerSettingsSection } from "../../features/appearance/LayoutSettingsSection";
import { PresetSettingsSection } from "../../features/appearance/PresetSettingsSection";
import { StyleSettingsSection } from "../../features/appearance/StyleSettingsSection";
import { ThemeModeSection } from "../../features/appearance/ThemeModeSection";
import { activeTone, resolveThemeColors, withThemeColors, type ThemeTone } from "../../features/appearance/themeMode";
import { useSystemDark } from "../../features/appearance/useResolvedTheme";
import type { IslandSettings } from "../../features/appearance/types";
import type { useSettingPresets } from "../../features/appearance/useSettingPresets";
import { requestPanelPreview } from "./storage";

/**
 * Settings → Theme: dark, light or system (C31) and which colour set to adjust (C33.3), then what
 * the island looks like (style, colours, corners) and the saved themes. The preview and the colour
 * rows show the set being adjusted, which starts as the one the island uses now.
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
  const systemDark = useSystemDark();
  const [editing, setEditing] = useState<ThemeTone | null>(null);
  const tone = editing ?? activeTone(settings.themeMode, systemDark);
  const shown = resolveThemeColors(settings, systemDark, tone);
  return (
    <>
      <IslandPreview settings={shown} />
      <ThemeModeSection settings={settings} editing={tone} onEditingChange={setEditing} onSettingsChange={onSettingsChange} />
      <StyleSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <ColorSettingsSection
        settings={shown}
        // A colour picked here goes into the set being adjusted; the brightness is shared.
        onSettingsChange={(next) => onSettingsChange(withThemeColors(next, tone, {
          islandBackgroundColor: next.islandBackgroundColor,
          taskTextColor: next.taskTextColor,
          pulseColor: next.pulseColor,
        }))}
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
