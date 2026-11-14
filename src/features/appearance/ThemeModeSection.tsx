import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsMultiChoice } from "../../components/settings/SettingsMultiChoice";
import { useTranslation } from "../../i18n";
import { AccentSettingsRow } from "./AccentSettingsRow";
import { IslandGlyph } from "./IslandGlyph";
import { activeTone, DARK_SURFACE_KEYS, DARK_SURFACES, THEME_MODES, type ThemeTone } from "./themeMode";
import { useSystemDark } from "./useResolvedTheme";
import type { IslandSettings, ThemeMode } from "./types";
import { isMacOS } from "../../lib/platform";

export function ThemeModeSection({ settings, onEditingChange, onSettingsChange }: {
  settings: IslandSettings;
  onEditingChange: (tone: ThemeTone) => void;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.colors;
  const dark = activeTone(settings.themeMode, useSystemDark()) === "dark";
  return (
    <SettingsGroup title={text.modeTitle}>
      <SettingsRow title={text.mode} description={isMacOS ? text.modeHintMac : text.modeHint}>
        <SettingsChoiceCards<ThemeMode>
          value={settings.themeMode}
          ariaLabel={text.mode}
          options={THEME_MODES.map((mode) => ({ value: mode, label: text.modes[mode], art: <IslandGlyph state="expanded" tone={mode} /> }))}
          onChange={(themeMode) => {
            onSettingsChange({ ...settings, themeMode });
            if (themeMode !== "system") onEditingChange(themeMode);
          }}
        />
      </SettingsRow>
      <SettingsRow
        title={text.stayDark}
        description={dark ? `${text.stayDarkHint} ${text.stayDarkNow}` : text.stayDarkHint}
        control={
          <SettingsMultiChoice
            values={DARK_SURFACES.filter((surface) => settings[DARK_SURFACE_KEYS[surface]])}
            ariaLabel={text.stayDark}
            options={DARK_SURFACES.map((surface) => ({ value: surface, label: text.stayDarkSurfaces[surface] }))}
            onToggle={(surface, selected) => onSettingsChange({ ...settings, [DARK_SURFACE_KEYS[surface]]: selected })}
          />
        }
      />
      <AccentSettingsRow settings={settings} onSettingsChange={onSettingsChange} />
    </SettingsGroup>
  );
}
