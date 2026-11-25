import { useId } from "react";
import { LayoutGrid, Timer, Volume2 } from "lucide-react";
import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsIconTitle } from "../../components/settings/SettingsIconTitle";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useTranslation } from "../../i18n";
import { playRingSound } from "./store";
import { TIMER_LAYOUTS, type TimerLayout } from "./timerLayout.ts";
import { TimerLayoutGlyph } from "./TimerLayoutGlyph";
import { useTimerConfig } from "./useTimerConfig";

export function TimerSoundGroup() {
  const t = useTranslation();
  const text = t.timer.settings;
  const layoutText = t.timer.layout;
  const [config, update] = useTimerConfig();
  const switchId = useId();
  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={layoutText.hint} />}>
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
      <SettingsRow title={<SettingsIconTitle icon={<LayoutGrid size={15} strokeWidth={1.9} />}>{layoutText.title}</SettingsIconTitle>}>
        <SettingsChoiceCards<TimerLayout>
          value={config.layout}
          ariaLabel={layoutText.title}
          columns={2}
          options={TIMER_LAYOUTS.map((id) => ({
            value: id,
            label: layoutText.options[id].name,
            hint: layoutText.options[id].hint,
            art: <TimerLayoutGlyph layout={id} />,
          }))}
          onChange={(layout) => update("layout", layout)}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
