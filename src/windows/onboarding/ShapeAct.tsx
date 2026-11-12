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
import { MiniDesk } from "./MiniDesk";
import { MiniIsland } from "./MiniIsland";
import type { OnboardingModule } from "./personas";

/** Act 2: dark or light, the accent and the corners, each seen at once on the island above. */
export function ShapeAct({ settings, shown, modules, onSettingsChange }: {
  settings: IslandSettings;
  /** The same settings in the colours of the tone in use. */
  shown: IslandSettings;
  modules: ReadonlySet<OnboardingModule>;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.onboarding.shape;

  return (
    <>
      <MiniDesk island={<MiniIsland settings={shown} modules={modules} label={t.onboarding.islandName} />} />
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
