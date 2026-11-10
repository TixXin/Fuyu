import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { THEME_MODES } from "./themeMode";
import type { IslandSettings, ThemeMode } from "./types";

/** Settings → Theme → Light and dark (C31): built-in colours, the system's, or the picked ones. */
export function ThemeModeSection({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.colors;
  return (
    <SettingsGroup title={text.modeTitle}>
      <SettingsRow
        title={text.mode}
        description={text.modeHint}
        control={
          <SettingsChoice<ThemeMode>
            value={settings.themeMode}
            ariaLabel={text.mode}
            options={THEME_MODES.map((mode) => ({ value: mode, label: text.modes[mode] }))}
            onChange={(themeMode) => onSettingsChange({ ...settings, themeMode })}
          />
        }
      />
    </SettingsGroup>
  );
}
