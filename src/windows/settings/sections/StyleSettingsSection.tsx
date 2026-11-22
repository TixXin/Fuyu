import type { ReactNode } from "react";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useTranslation } from "../../../i18n";
import type { AppearanceMode, IslandFont, IslandSettings } from "../../../lib/settings/types";
import { OpacityCards } from "./OpacityCards";

export function StyleSettingsSection({
  settings,
  children,
  onSettingsChange,
}: {
  settings: IslandSettings;
  children?: ReactNode;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.appearance;
  const modes = [
    { value: "classic", label: text.classic },
    { value: "liquidGlass", label: text.liquidGlass },
  ] as const;
  const fonts = [
    { value: "system", label: text.systemFont },
    { value: "pixel", label: text.pixelFont },
  ] as const;

  return (
    <>
      <SettingsGroup title={text.styleTitle}>
        <SettingsRow
          title={text.title}
          control={
            <SettingsChoice<AppearanceMode>
              value={settings.appearanceMode}
              options={modes}
              ariaLabel={text.title}
              onChange={(appearanceMode) => onSettingsChange({ ...settings, appearanceMode })}
            />
          }
        />
        <SettingsRow
          title={text.font}
          control={
            <SettingsChoice<IslandFont>
              value={settings.fontFamily}
              options={fonts}
              ariaLabel={text.fontLabel}
              onChange={(fontFamily) => onSettingsChange({ ...settings, fontFamily })}
            />
          }
        />
        {children}
      </SettingsGroup>
      <OpacityCards settings={settings} onSettingsChange={onSettingsChange} />
    </>
  );
}
