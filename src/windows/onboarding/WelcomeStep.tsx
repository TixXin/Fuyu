import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { IslandPreview } from "../../features/appearance/IslandPreview";
import { THEME_MODES } from "../../features/appearance/themeMode";
import { useResolvedTheme } from "../../features/appearance/useResolvedTheme";
import type { IslandSettings, ThemeMode } from "../../features/appearance/types";
import { LOCALE_CODES, TRANSLATIONS, useLocale, useTranslation } from "../../i18n";

/** Step 1: what the island is, and the two choices that change how everything after looks. */
export function WelcomeStep({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const t = useTranslation();
  const text = t.onboarding.welcome;
  const { locale, setLocale } = useLocale();
  // The island in the colours of the dark or light set just picked.
  const preview = useResolvedTheme(settings);

  return (
    <>
      <IslandPreview settings={preview} compact />
      <SettingsGroup>
      <SettingsRow
        title={text.language}
        control={
          <SettingsChoice
            value={locale}
            ariaLabel={text.language}
            options={LOCALE_CODES.map((code) => ({ value: code, label: TRANSLATIONS[code].localeLabel }))}
            onChange={setLocale}
          />
        }
      />
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
      </SettingsGroup>
    </>
  );
}
