import { useId } from "react";
import { Timer, Volume2 } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsIconTitle } from "../../components/settings/SettingsIconTitle";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useTranslation } from "../../i18n";
import { playRingSound } from "./store";
import { useTimerConfig } from "./useTimerConfig";

export function TimerSoundGroup() {
  const t = useTranslation();
  const text = t.timer.settings;
  const [config, update] = useTimerConfig();
  const switchId = useId();
  return (
    <SettingsGroup title={text.title}>
      <SettingsRow
        title={<SettingsIconTitle icon={<Timer size={15} strokeWidth={1.9} />}>{text.sound}</SettingsIconTitle>}
        description={text.soundHint}
        labelFor={switchId}
        control={
          <>
            <SettingsLinkButton onClick={playRingSound}>
              <Volume2 size={13} strokeWidth={2.2} aria-hidden="true" />
              {t.settings.sounds.preview}
            </SettingsLinkButton>
            <SettingsSwitch id={switchId} checked={config.sound} onChange={(sound) => update("sound", sound)} />
          </>
        }
      />
    </SettingsGroup>
  );
}
