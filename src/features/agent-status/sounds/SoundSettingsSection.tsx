import { useCallback, useEffect, useState } from "react";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useLocale, useTranslation } from "../../../i18n";
import { listSoundPacks, soundPackName, type SoundPack } from "./api";
import { forgetSoundPacks, previewAgentSound } from "./player";
import { SoundPacksGroup } from "./SoundPacksGroup";
import { BUILTIN_PACK, DEFAULT_AGENT_SOUND_SETTINGS, type AgentSoundSettings } from "./storage";
import { useAgentSoundSettings } from "./useAgentSoundSettings";
import "./SoundSettingsSection.css";

export function SoundSettingsSection({ onShowPage }: { onShowPage?: (page: "agentAlerts") => void }) {
  const t = useTranslation();
  const table = t.settings.agentNotice.table;
  const { locale } = useLocale();
  const text = t.settings.sounds;
  const [settings, setSettings] = useAgentSoundSettings();
  const [packs, setPacks] = useState<SoundPack[]>([]);
  const update = (patch: Partial<AgentSoundSettings>) => setSettings((current) => ({ ...current, ...patch }));

  const reloadPacks = useCallback(() => {
    forgetSoundPacks();
    void listSoundPacks()
      .then(setPacks)
      .catch((error: unknown) => console.error("Failed to list the sound packs", error));
  }, []);
  useEffect(reloadPacks, [reloadPacks]);

  const packOptions = [
    { value: BUILTIN_PACK, label: text.builtinPack },
    ...packs.map((pack) => ({ value: pack.id, label: soundPackName(pack, locale) })),
  ];
  const packValue = packOptions.some((option) => option.value === settings.pack) ? settings.pack : BUILTIN_PACK;

  return (
    <>
      <SettingsGroup title={text.title}>
        <SettingsToggleRow
          title={text.enabled}
          description={text.enabledHint}
          checked={settings.enabled}
          onChange={(enabled) => update({ enabled })}
        />
        {settings.enabled && (
          <>
            <SettingsSliderRow
              indent
              title={text.volume}
              value={settings.volume}
              min={0}
              max={100}
              step={5}
              format={(value) => `${Math.round(value)}%`}
              defaultValue={DEFAULT_AGENT_SOUND_SETTINGS.volume}
              resetLabel={t.settings.layout.resetToDefault}
              onChange={(volume) => update({ volume })}
            />
            <SettingsRow
              indent
              title={text.pack}
              control={
                <SettingsSelect
                  value={packValue}
                  options={packOptions}
                  ariaLabel={text.pack}
                  onChange={(pack) => {
                    update({ pack });
                    void previewAgentSound("complete", pack, settings.volume);
                  }}
                />
              }
            />
          </>
        )}
        {onShowPage ? (
          <SettingsRow
            title={table.soundsMoved}
            control={<SettingsLinkButton onClick={() => onShowPage("agentAlerts")}>{table.openTable}</SettingsLinkButton>}
          />
        ) : null}
      </SettingsGroup>

      {settings.enabled && (
        <SettingsGroup title={text.quietTitle} footer={<SettingsFootnote text={text.quietFooter} />}>
          <SettingsToggleRow
            title={text.quietWhenInFront}
            description={text.quietWhenInFrontHint}
            checked={settings.quietWhenInFront}
            onChange={(quietWhenInFront) => update({ quietWhenInFront })}
          />
          <SettingsToggleRow
            title={text.quietHours}
            description={text.quietHoursHint}
            checked={settings.quietHours.enabled}
            onChange={(enabled) => update({ quietHours: { ...settings.quietHours, enabled } })}
          />
          {settings.quietHours.enabled && (
            <SettingsRow
              indent
              title={text.quietRange}
              control={
                <span className="sound-settings__times">
                  <input
                    type="time"
                    aria-label={text.quietFrom}
                    value={settings.quietHours.start}
                    onChange={(event) => event.currentTarget.value && update({ quietHours: { ...settings.quietHours, start: event.currentTarget.value } })}
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="time"
                    aria-label={text.quietTo}
                    value={settings.quietHours.end}
                    onChange={(event) => event.currentTarget.value && update({ quietHours: { ...settings.quietHours, end: event.currentTarget.value } })}
                  />
                </span>
              }
            />
          )}
        </SettingsGroup>
      )}

      <SoundPacksGroup
        packs={packs}
        onChanged={(imported) => {
          reloadPacks();
          if (imported) update({ pack: imported.id });
        }}
      />
    </>
  );
}
