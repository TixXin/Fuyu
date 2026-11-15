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

type ThemeSectionProps = {
  settings: IslandSettings;
  presets: ReturnType<typeof useSettingPresets>;
  onSettingsChange: (settings: IslandSettings) => void;
  tone: ThemeTone;
  shown: IslandSettings;
  onEditingChange: (tone: ThemeTone | null) => void;
};

function BuiltinSection({ settings, onSettingsChange, onEditingChange: setEditing }: ThemeSectionProps) {
  return (
    <BuiltinThemesSection
      settings={settings}
      onApply={(next) => {
        setEditing(null);
        onSettingsChange(next);
      }}
    />
  );
}

function ColorsSection({ settings, onSettingsChange, tone, shown, onEditingChange: setEditing }: ThemeSectionProps) {
  return (
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
  );
}

function StyleSection({ settings, onSettingsChange }: ThemeSectionProps) {
  return (
    <StyleSettingsSection settings={settings} onSettingsChange={onSettingsChange}>
      <CornerSettingsRows
        settings={settings}
        onSettingsChange={onSettingsChange}
        onPreviewIsland={(expanded) => requestPanelPreview(expanded ? "expanded" : "collapsed")}
      />
    </StyleSettingsSection>
  );
}

function PresetsSection({ presets }: ThemeSectionProps) {
  return <PresetSettingsSection {...presets} />;
}

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
  const props = { settings, presets, onSettingsChange, tone, shown, onEditingChange: setEditing };
  return (
    <>
      <IslandPreview settings={shown} />
      <ThemeModeSection settings={settings} onEditingChange={setEditing} onSettingsChange={onSettingsChange} />
      <BuiltinSection {...props} />
      <ColorsSection {...props} />
      <StyleSection {...props} />
      <PresetsSection {...props} />
    </>
  );
}
