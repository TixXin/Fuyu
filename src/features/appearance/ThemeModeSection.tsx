import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { AccentSettingsRow } from "./AccentSettingsRow";
import { IslandGlyph } from "./IslandGlyph";
import { THEME_MODES, type ThemeTone } from "./themeMode";
import type { IslandSettings, ThemeMode } from "./types";
import { isMacOS } from "../../lib/platform";

export function ThemeModeSection({ settings, onEditingChange, onSettingsChange }: {
  settings: IslandSettings;
  onEditingChange: (tone: ThemeTone) => void;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.colors;
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
      <SettingsToggleRow
        title={text.collapsedDark}
        description={text.collapsedDarkHint}
        checked={settings.collapsedDark}
        onChange={(collapsedDark) => onSettingsChange({ ...settings, collapsedDark })}
      />
      <AccentSettingsRow settings={settings} onSettingsChange={onSettingsChange} />
    </SettingsGroup>
  );
}
