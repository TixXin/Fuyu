import { Timer } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsIconTitle } from "../../components/settings/SettingsIconTitle";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { useTimerConfig } from "./useTimerConfig";

export function TimerSoundGroup() {
  const text = useTranslation().timer.settings;
  const [config, update] = useTimerConfig();
  return (
    <SettingsGroup title={text.title}>
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<Timer size={15} strokeWidth={1.9} />}>{text.sound}</SettingsIconTitle>}
        description={text.soundHint}
        checked={config.sound}
        onChange={(sound) => update("sound", sound)}
      />
    </SettingsGroup>
  );
}
