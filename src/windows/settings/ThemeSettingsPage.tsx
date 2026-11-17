import { useState } from "react";
import { BuiltinThemesSection } from "./sections/BuiltinThemesSection";
import { ColorSettingsSection } from "./sections/ColorSettingsSection";
import { IslandPreview } from "../../components/island-preview/IslandPreview";
import { GlassSettingsSection } from "./sections/GlassSettingsSection";
import { CornerSettingsRows } from "./sections/LayoutSettingsSection";
import { PresetSettingsSection } from "./sections/PresetSettingsSection";
import { StyleSettingsSection } from "./sections/StyleSettingsSection";
import { ThemeModeSection } from "./sections/ThemeModeSection";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { activeTone, resolveThemeColors, THEME_COLORS, withThemeColors, type ThemeTone } from "../../lib/theme/themeMode";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import type { AppearanceMode, IslandSettings } from "../../lib/settings/types";
import type { useSettingPresets } from "../../lib/settings/useSettingPresets";
import { requestPanelPreview } from "./storage";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

export type ThemeTab = "theme" | "themeStyle" | "themeGlass" | "themePresets";

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

function GlassSection({ settings, onSettingsChange }: ThemeSectionProps) {
  const text = useTranslation().settings.appearance;
  if (settings.appearanceMode !== "liquidGlass") {
    return (
      <SettingsGroup title={text.glass.title}>
        <SettingsRow
          searchable={false}
          title={text.title}
          description={text.glass.pauseHint}
          control={
            <SettingsChoice<AppearanceMode>
              value={settings.appearanceMode}
              ariaLabel={text.title}
              options={[
                { value: "classic", label: text.classic },
                { value: "liquidGlass", label: text.liquidGlass },
              ]}
              onChange={(appearanceMode) => onSettingsChange({ ...settings, appearanceMode })}
            />
          }
        />
      </SettingsGroup>
    );
  }
  return <GlassSettingsSection settings={settings} onSettingsChange={onSettingsChange} />;
}

function PresetsSection({ presets }: ThemeSectionProps) {
  return <PresetSettingsSection {...presets} />;
}

const sections = settingsSections<ThemeSectionProps, ThemeTab>();

sections.add({ id: "theme.mode", category: "theme", order: 10, component: ThemeModeSection });
sections.add({ id: "theme.builtin", category: "theme", order: 20, component: BuiltinSection });
sections.add({ id: "theme.colors", category: "theme", order: 30, component: ColorsSection });
sections.add({ id: "themeStyle.style", category: "themeStyle", order: 10, component: StyleSection });
sections.add({ id: "themeGlass.glass", category: "themeGlass", order: 10, component: GlassSection });
sections.add({ id: "themePresets.presets", category: "themePresets", order: 10, component: PresetsSection });

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
      <IslandPreview settings={shown} />
      <SlotView slot={sections} group={tab} props={props} />
    </>
  );
}
