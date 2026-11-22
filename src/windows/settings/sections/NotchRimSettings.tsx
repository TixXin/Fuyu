import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { DEFAULT_NOTCH_RIM_SETTINGS, notchRimLook, withNotchRimLook } from "../../../lib/settings/notchRimSettings";
import type { IslandSettings } from "../../../lib/settings/types";
import { NotchRimLookRows } from "./NotchRimLookRows";

export function NotchRimSettings({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.notchRim;

  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.hint} />}>
      <NotchRimLookRows
        title={text.island}
        description={text.islandHint}
        look={notchRimLook(settings, "Island")}
        defaults={notchRimLook(DEFAULT_NOTCH_RIM_SETTINGS, "Island")}
        onChange={(patch) => onSettingsChange({ ...settings, ...withNotchRimLook(settings, "Island", patch) })}
      />
      <SettingsToggleRow
        title={text.panelSame}
        checked={settings.notchRimPanelSame}
        onChange={(notchRimPanelSame) => onSettingsChange({ ...settings, notchRimPanelSame })}
      />
      {!settings.notchRimPanelSame && (
        <NotchRimLookRows
          title={text.panel}
          description={text.panelHint}
          look={notchRimLook(settings, "Panel")}
          defaults={notchRimLook(DEFAULT_NOTCH_RIM_SETTINGS, "Panel")}
          onChange={(patch) => onSettingsChange({ ...settings, ...withNotchRimLook(settings, "Panel", patch) })}
        />
      )}
    </SettingsGroup>
  );
}
