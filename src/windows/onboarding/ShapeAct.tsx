import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../components/settings/SettingsSliderRow";
import { AccentSettingsRow } from "../../features/appearance/AccentSettingsRow";
import { IslandMotionRow } from "../../features/appearance/IslandMotionRow";
import { DEFAULT_ISLAND_CORNER_RADIUS, MAX_ISLAND_CORNER_RADIUS, MIN_ISLAND_CORNER_RADIUS } from "../../features/appearance/settingsLimits";
import { THEME_MODES } from "../../features/appearance/themeMode";
import type { IslandCornerShape, IslandSettings, ThemeMode } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";

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
        <SettingsRow
          title={t.settings.layout.islandCornerShape}
          control={
            <SettingsChoice<IslandCornerShape>
              value={settings.islandCornerShape}
              ariaLabel={t.settings.layout.islandCornerShape}
              options={[
                { value: "squircle", label: t.settings.layout.cornerShapeSquircle },
                { value: "round", label: t.settings.layout.cornerShapeRound },
              ]}
              onChange={(islandCornerShape) => onSettingsChange({ ...settings, islandCornerShape })}
            />
          }
        />
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
        <IslandMotionRow value={settings.islandMotion} onChange={(islandMotion) => onSettingsChange({ ...settings, islandMotion })} />
      </SettingsGroup>
    </>
  );
}
