import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsColor } from "../../components/settings/SettingsColor";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { AccentMode, IslandSettings } from "./types";

/** Settings → Theme → the accent (C33.5): as it ships, Windows', or a picked colour. */
export function AccentSettingsRow({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.colors;
  return (
    <>
      <SettingsRow
        title={text.accent}
        description={text.accentHint}
        control={
          <SettingsChoice<AccentMode>
            value={settings.accentMode}
            ariaLabel={text.accent}
            options={(["default", "windows", "pick"] as const).map((mode) => ({ value: mode, label: text.accentModes[mode] }))}
            onChange={(accentMode) => onSettingsChange({ ...settings, accentMode })}
          />
        }
      />
      {settings.accentMode === "pick" && (
        <SettingsRow
          indent
          title={text.accentColor}
          control={<SettingsColor value={settings.accentColor} ariaLabel={text.accentColor} onChange={(accentColor) => onSettingsChange({ ...settings, accentColor })} />}
        />
      )}
    </>
  );
}
