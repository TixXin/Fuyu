import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { DEFAULT_NOTCH_RING_SETTINGS, NOTCH_RING_BOTTOMS, notchRingLook, withNotchRingLook } from "../../../lib/settings/notchRingSettings";
import type { IslandSettings } from "../../../lib/settings/types";
import { NotchRingLookRows } from "./NotchRingLookRows";

export function NotchRingSettings({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.notchRing;
  const island = notchRingLook(settings, "Island");

  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.hint} />}>
      <NotchRingLookRows
        title={text.island}
        description={text.islandHint}
        look={island}
        defaults={notchRingLook(DEFAULT_NOTCH_RING_SETTINGS, "Island")}
        onChange={(patch) => onSettingsChange({ ...settings, ...withNotchRingLook(settings, "Island", patch) })}
      />
      {(island.style !== "off" || island.device || island.status) && (
        <SettingsRow
          indent
          title={text.bottom}
          description={text.bottomHint}
          control={(
            <SettingsSelect
              value={settings.notchRingIslandBottom}
              options={NOTCH_RING_BOTTOMS.map((value) => ({ value, label: text.bottoms[value] }))}
              ariaLabel={text.bottom}
              onChange={(notchRingIslandBottom) => onSettingsChange({ ...settings, notchRingIslandBottom })}
            />
          )}
        />
      )}
      <SettingsToggleRow
        title={text.panelSame}
        checked={settings.notchRingPanelSame}
        onChange={(notchRingPanelSame) => onSettingsChange({ ...settings, notchRingPanelSame })}
      />
      {!settings.notchRingPanelSame && (
        <NotchRingLookRows
          title={text.panel}
          description={text.panelHint}
          look={notchRingLook(settings, "Panel")}
          defaults={notchRingLook(DEFAULT_NOTCH_RING_SETTINGS, "Panel")}
          onChange={(patch) => onSettingsChange({ ...settings, ...withNotchRingLook(settings, "Panel", patch) })}
        />
      )}
    </SettingsGroup>
  );
}
