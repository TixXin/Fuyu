import type { ReactNode } from "react";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { useTranslation } from "../../../i18n";
import { DEFAULT_SETTINGS, MAX_ISLAND_OPACITY, MIN_ISLAND_OPACITY } from "../../../lib/settings/settings";
import type { AppearanceMode, IslandFont, IslandSettings } from "../../../lib/settings/types";

const percent = (value: number) => `${Math.round(value)}%`;

export function StyleSettingsSection({
  settings,
  children,
  onSettingsChange,
}: {
  settings: IslandSettings;
  children?: ReactNode;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.appearance;
  const modes = [
    { value: "classic", label: text.classic },
    { value: "liquidGlass", label: text.liquidGlass },
  ] as const;
  const fonts = [
    { value: "system", label: text.systemFont },
    { value: "pixel", label: text.pixelFont },
  ] as const;

  return (
    <SettingsGroup title={text.styleTitle}>
      <SettingsRow
        title={text.title}
        control={
          <SettingsChoice<AppearanceMode>
            value={settings.appearanceMode}
            options={modes}
            ariaLabel={text.title}
            onChange={(appearanceMode) => onSettingsChange({ ...settings, appearanceMode })}
          />
        }
      />
      <SettingsRow
        title={text.font}
        control={
          <SettingsChoice<IslandFont>
            value={settings.fontFamily}
            options={fonts}
            ariaLabel={text.fontLabel}
            onChange={(fontFamily) => onSettingsChange({ ...settings, fontFamily })}
          />
        }
      />
      <SettingsSliderRow
        title={t.settings.layout.opacity}
        description={t.settings.layout.opacityHint}
        value={settings.opacity}
        min={50}
        max={100}
        step={1}
        format={percent}
        defaultValue={DEFAULT_SETTINGS.opacity}
        resetLabel={t.settings.layout.resetToDefault}
        onChange={(opacity) => onSettingsChange({ ...settings, opacity })}
      />
      <SettingsSliderRow
        title={t.settings.layout.islandOpacity}
        description={t.settings.layout.islandOpacityHint}
        value={settings.islandOpacity}
        min={MIN_ISLAND_OPACITY}
        max={MAX_ISLAND_OPACITY}
        step={1}
        format={percent}
        defaultValue={DEFAULT_SETTINGS.islandOpacity}
        resetLabel={t.settings.layout.resetToDefault}
        onChange={(islandOpacity) => onSettingsChange({ ...settings, islandOpacity })}
      />
      {children}
    </SettingsGroup>
  );
}
