import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { AccentSettingsRow } from "./AccentSettingsRow";
import { THEME_COLORS, THEME_MODES, withThemeColors, type ThemeTone } from "./themeMode";
import type { IslandSettings, ThemeMode } from "./types";

/**
 * Settings → Theme → Light and dark (C31, C33.3): which colour set the island uses (dark, light or
 * the system's), which set the colour rows below adjust, and keeping a light island dark while
 * collapsed (C33.2).
 */
export function ThemeModeSection({ settings, editing, onEditingChange, onSettingsChange }: {
  settings: IslandSettings;
  /** The set the colour rows show and change. */
  editing: ThemeTone;
  onEditingChange: (tone: ThemeTone) => void;
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
            onChange={(themeMode) => {
              onSettingsChange({ ...settings, themeMode });
              // Adjust what was just chosen; "system" keeps whichever set it shows now.
              if (themeMode !== "system") onEditingChange(themeMode);
            }}
          />
        }
      />
      <SettingsRow
        title={text.editing}
        description={text.editingHint}
        control={
          <>
            <SettingsChoice<ThemeTone>
              value={editing}
              ariaLabel={text.editing}
              options={(["dark", "light"] as const).map((tone) => ({ value: tone, label: text.modes[tone] }))}
              onChange={onEditingChange}
            />
            <SettingsLinkButton onClick={() => onSettingsChange(withThemeColors(settings, editing, THEME_COLORS[editing]))}>
              {text.resetSet}
            </SettingsLinkButton>
          </>
        }
      />
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
