import { useEffect, useState } from "react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsInput } from "../../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useErrorText, useTranslation } from "../../../i18n";
import { ccConnectReason } from "../../../lib/cc-connect/service";
import { deleteBarkKey, hasBarkKey, saveBarkKey, sendBarkPush } from "./api";
import { CcConnectPushTargets } from "./CcConnectPushTargets";
import { PUSH_GROUP, sendCcConnect } from "./sendPush";
import { AGENT_PUSH_AWAY_MINUTES, AGENT_PUSH_CHANNELS, AGENT_PUSH_EVENTS, LOCAL_HOST, type AgentPushChannel } from "./storage";
import { isMacOS } from "../../../lib/platform";
import { useAgentPushSettings } from "./useAgentPushSettings";
import { useCcConnectTargets } from "./useCcConnectTargets";

export function AgentPushSettings() {
  const text = useTranslation().settings.agent.push;
  const errorText = useErrorText();
  const [settings, setSettings] = useAgentPushSettings();
  const [keySaved, setKeySaved] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bark = settings.channel === "bark";
  const targets = useCcConnectTargets(settings.enabled && !bark);

  useEffect(() => {
    void hasBarkKey().then(setKeySaved).catch(() => setKeySaved(false));
  }, []);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      setStatus(done);
    } catch (error) {
      setStatus(errorText(ccConnectReason(error)));
    } finally {
      setBusy(false);
    }
  };
  const saveKey = () =>
    run(async () => {
      await saveBarkKey(keyInput);
      setKeyInput("");
      setKeySaved(true);
    }, text.keySaved);
  const clearKey = () =>
    run(async () => {
      await deleteBarkKey();
      setKeySaved(false);
    }, text.keyCleared);
  const testChats = Object.entries(settings.ccConnect)
    .filter(([host, entry]) => !settings.mutedHosts.includes(host) && !entry.viaLocal)
    .flatMap(([host, entry]) => entry.chats.map((chat) => ({ ...chat, host })));
  const test = () =>
    run(
      () =>
        bark
          ? sendBarkPush(settings.server, text.testTitle, text.testBody, PUSH_GROUP)
          : Promise.all(
              testChats.map(({ host, project, key }) =>
                sendCcConnect(host, project, key, host === LOCAL_HOST ? text.ccConnect.testBody : `${text.ccConnect.testBody} · ${host}`),
              ),
            ),
      text.testSent,
    );
  const canTest = bark ? keySaved === true : targets.on && testChats.length > 0;

  const awayOptions = AGENT_PUSH_AWAY_MINUTES.map((minutes) => ({ value: String(minutes), label: text.awayValue(minutes) }));
  const channelOptions = AGENT_PUSH_CHANNELS.map((channel) => ({ value: channel, label: text.channels[channel] }));

  return (
    <SettingsGroup title={text.title} footer={bark ? text.hint : text.ccConnectHint}>
      <SettingsToggleRow title={text.enabled} description={text.enabledHint} checked={settings.enabled} onChange={(enabled) => setSettings({ ...settings, enabled })} />
      {settings.enabled && (
        <>
          <SettingsRow
            indent
            title={text.channel}
            control={
              <SettingsSelect
                value={settings.channel}
                options={channelOptions}
                ariaLabel={text.channel}
                onChange={(channel: AgentPushChannel) => setSettings({ ...settings, channel })}
              />
            }
          />
          {!bark && !targets.on ? <SettingsRow indent title={text.ccConnect.off} description={text.ccConnect.offHint} /> : null}
          {!bark || targets.hosts.length > 0 ? (
            <CcConnectPushTargets settings={settings} onChange={setSettings} targets={targets} picking={!bark && targets.on} />
          ) : null}
          {bark && (
            <>
              <SettingsRow indent title={text.server} description={text.serverHint}>
                <SettingsInput
                  monospace
                  value={settings.server}
                  placeholder="https://api.day.app"
                  aria-label={text.server}
                  onChange={(event) => setSettings({ ...settings, server: event.target.value })}
                />
              </SettingsRow>
              <SettingsRow
                indent
                title={text.key}
                description={keySaved ? (isMacOS ? text.keyIsSavedMac : text.keyIsSaved) : text.keyHint}
                control={
                  keySaved ? (
                    <SettingsLinkButton tone="danger" disabled={busy} onClick={() => void clearKey()}>{text.clearKey}</SettingsLinkButton>
                  ) : (
                    <SettingsLinkButton disabled={busy || !keyInput.trim()} onClick={() => void saveKey()}>{text.saveKey}</SettingsLinkButton>
                  )
                }
              >
                {!keySaved && (
                  <SettingsInput
                    monospace
                    type="password"
                    value={keyInput}
                    placeholder={text.keyPlaceholder}
                    aria-label={text.key}
                    onChange={(event) => setKeyInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && keyInput.trim()) void saveKey();
                    }}
                  />
                )}
              </SettingsRow>
            </>
          )}
          {AGENT_PUSH_EVENTS.map((event) => (
            <SettingsToggleRow
              key={event}
              indent
              title={text.events[event]}
              checked={settings.events[event]}
              onChange={(on) => setSettings({ ...settings, events: { ...settings.events, [event]: on } })}
            />
          ))}
          <SettingsRow
            indent
            title={text.away}
            description={text.awayHint}
            control={
              <SettingsSelect
                value={String(settings.awayMinutes)}
                options={awayOptions}
                ariaLabel={text.away}
                onChange={(value) => setSettings({ ...settings, awayMinutes: Number(value) })}
              />
            }
          />
          <SettingsRow
            indent
            title={text.test}
            description={status ?? undefined}
            control={<SettingsLinkButton disabled={busy || !canTest} onClick={() => void test()}>{text.testAction}</SettingsLinkButton>}
          />
        </>
      )}
    </SettingsGroup>
  );
}
