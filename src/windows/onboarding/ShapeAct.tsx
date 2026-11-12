import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../components/settings/SettingsSliderRow";
import { AccentSettingsRow } from "../../features/appearance/AccentSettingsRow";
import { DEFAULT_ISLAND_CORNER_RADIUS, MAX_ISLAND_CORNER_RADIUS, MIN_ISLAND_CORNER_RADIUS } from "../../features/appearance/settingsLimits";
import { THEME_MODES } from "../../features/appearance/themeMode";
import type { IslandSettings, ThemeMode } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";

/** Act 2: dark or light, the accent and the corners, each seen at once on the real island. */
export function ShapeAct({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const t = useTranslation();
  const text = t.onboarding.shape;

  return (
    <>
      <ActHeading title={text.title} lead={text.lead} />
      <SettingsGroup>
        <SettingsRow
          title={text.theme}
          control={
            <SettingsChoice<ThemeMode>
              value={settings.themeMode}
              ariaLabel={text.theme}
              options={THEME_MODES.map((mode) => ({ value: mode, label: t.settings.colors.modes[mode] }))}
              onChange={(themeMode) => onSettingsChange({ ...settings, themeMode })}
            />
          }
        />
        <AccentSettingsRow settings={settings} onSettingsChange={onSettingsChange} />
        <SettingsSliderRow
          title={text.corners}
          value={settings.islandCornerRadius}
          min={MIN_ISLAND_CORNER_RADIUS}
          max={MAX_ISLAND_CORNER_RADIUS}
          step={1}
          format={(value) => `${value}px`}
          defaultValue={DEFAULT_ISLAND_CORNER_RADIUS}
          resetLabel={t.settings.layout.resetToDefault}
          onChange={(islandCornerRadius) => onSettingsChange({ ...settings, islandCornerRadius })}
        />
      </SettingsGroup>
    </>
  );
}
