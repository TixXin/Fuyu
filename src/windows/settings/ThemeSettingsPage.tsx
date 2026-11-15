import { useState } from "react";
import { BuiltinThemesSection } from "../../features/appearance/BuiltinThemesSection";
import { ColorSettingsSection } from "../../features/appearance/ColorSettingsSection";
import { IslandPreview } from "../../features/appearance/IslandPreview";
import { CornerSettingsRows } from "../../features/appearance/LayoutSettingsSection";
import { PresetSettingsSection } from "../../features/appearance/PresetSettingsSection";
import { StyleSettingsSection } from "../../features/appearance/StyleSettingsSection";
import { ThemeModeSection } from "../../features/appearance/ThemeModeSection";
import { activeTone, resolveThemeColors, THEME_COLORS, withThemeColors, type ThemeTone } from "../../features/appearance/themeMode";
import { useSystemDark } from "../../features/appearance/useResolvedTheme";
import type { IslandSettings } from "../../features/appearance/types";
import type { useSettingPresets } from "../../features/appearance/useSettingPresets";
import { requestPanelPreview } from "./storage";

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
      <ThemeModeSection settings={settings} onEditingChange={setEditing} onSettingsChange={onSettingsChange} />
      <BuiltinThemesSection
        settings={settings}
        onApply={(next) => {
          setEditing(null);
          onSettingsChange(next);
        }}
      />
      <ColorSettingsSection
        settings={shown}
        editing={tone}
        onEditingChange={setEditing}
        onResetSet={() => onSettingsChange(withThemeColors(settings, tone, THEME_COLORS[tone]))}
        onSettingsChange={(next) => onSettingsChange(withThemeColors(next, tone, {
          islandBackgroundColor: next.islandBackgroundColor,
          taskTextColor: next.taskTextColor,
          pulseColor: next.pulseColor,
          inkColor: next.inkColor,
        }))}
      />
      <StyleSettingsSection settings={settings} onSettingsChange={onSettingsChange}>
        <CornerSettingsRows
          settings={settings}
          onSettingsChange={onSettingsChange}
          onPreviewIsland={(expanded) => requestPanelPreview(expanded ? "expanded" : "collapsed")}
        />
      </StyleSettingsSection>
      <PresetSettingsSection {...presets} />
    </>
  );
}
