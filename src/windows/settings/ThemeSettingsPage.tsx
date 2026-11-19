import { useState } from "react";
import { BuiltinThemesSection } from "./sections/BuiltinThemesSection";
import { ColorSettingsSection } from "./sections/ColorSettingsSection";
import { StickyIslandPreview } from "./StickyIslandPreview";
import { GlassSettingsSection } from "./sections/GlassSettingsSection";
import { IdleDimSettingsSection } from "./sections/IdleDimSettingsSection";
import { CornerSettingsRows } from "./sections/LayoutSettingsSection";
import { PresetSettingsSection } from "./sections/PresetSettingsSection";
import { StyleSettingsSection } from "./sections/StyleSettingsSection";
import { ThemeModeSection } from "./sections/ThemeModeSection";
import { activeTone, resolveThemeColors, THEME_COLORS, withThemeColors, type ThemeTone } from "../../lib/theme/themeMode";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import type { IslandSettings } from "../../lib/settings/types";
import type { useSettingPresets } from "../../lib/settings/useSettingPresets";
import { requestPanelPreview } from "./storage";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

export type ThemeTab = "theme" | "themeStyle";

type ThemeSectionProps = {
  settings: IslandSettings;
  presets: ReturnType<typeof useSettingPresets>;
  onSettingsChange: (settings: IslandSettings) => void;
  tone: ThemeTone;
  shown: IslandSettings;
  onEditingChange: (tone: ThemeTone | null) => void;
};

function BuiltinSection({ settings, shown, onSettingsChange, onEditingChange: setEditing }: ThemeSectionProps) {
  return (
    <BuiltinThemesSection
      settings={settings}
      shown={shown}
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

function GlassSection({ settings, onSettingsChange }: ThemeSectionProps) {
  return <GlassSettingsSection settings={settings} onSettingsChange={onSettingsChange} />;
}

function IdleDimSection({ settings, onSettingsChange }: ThemeSectionProps) {
  return <IdleDimSettingsSection settings={settings} onSettingsChange={onSettingsChange} />;
}

function PresetsSection({ presets }: ThemeSectionProps) {
  return <PresetSettingsSection {...presets} />;
}

const sections = settingsSections<ThemeSectionProps, ThemeTab>();

sections.add({ id: "theme.mode", category: "theme", order: 40, component: ThemeModeSection });
sections.add({ id: "theme.builtin", category: "theme", order: 10, component: BuiltinSection });
sections.add({ id: "theme.colors", category: "theme", order: 50, component: ColorsSection });
sections.add({ id: "theme.presets", category: "theme", order: 20, component: PresetsSection });
sections.add({ id: "themeStyle.style", category: "themeStyle", order: 10, component: StyleSection });
sections.add({ id: "themeStyle.idleDim", category: "themeStyle", order: 15, component: IdleDimSection });
sections.add({ id: "themeStyle.glass", category: "themeStyle", order: 20, component: GlassSection });

export function ThemeSettingsPage({
  tab,
  settings,
  presets,
  onSettingsChange,
}: {
  tab: ThemeTab;
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
      <StickyIslandPreview settings={shown} />
      <SlotView slot={sections} group={tab} props={props} />
    </>
  );
}
