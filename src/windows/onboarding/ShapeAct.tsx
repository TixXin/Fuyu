import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { AccentSettingsRow } from "../../features/appearance/AccentSettingsRow";
import { THEME_MODES } from "../../features/appearance/themeMode";
import type { IslandSettings, ThemeMode } from "../../features/appearance/types";
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
      </SettingsGroup>
    </>
  );
}
