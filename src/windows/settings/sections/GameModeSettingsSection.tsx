import { useTranslation } from "../../../i18n";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../../lib/settings/types";

export function GameModeSettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.gameMode;

  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.hint} />}>
      <SettingsToggleRow
        title={text.doNotDisturb}
        description={text.doNotDisturbHint}
        checked={settings.gameDoNotDisturb}
        onChange={(gameDoNotDisturb) => onSettingsChange({ ...settings, gameDoNotDisturb })}
      />
      <SettingsToggleRow
        title={text.autoTuck}
        description={text.autoTuckHint}
        checked={settings.gameAutoTuck}
        onChange={(gameAutoTuck) => onSettingsChange({ ...settings, gameAutoTuck })}
      />
    </SettingsGroup>
  );
}
