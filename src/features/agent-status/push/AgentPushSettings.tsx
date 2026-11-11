import { useEffect, useState } from "react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsInput } from "../../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useErrorText, useTranslation } from "../../../i18n";
import { sendCcConnectMessage, sendCcConnectRemoteMessage, useCcConnect } from "../../cc-connect";
import { deleteBarkKey, hasBarkKey, saveBarkKey, sendBarkPush } from "./api";
import { CcConnectPushTargets } from "./CcConnectPushTargets";
import { PUSH_GROUP } from "./sendPush";
import { AGENT_PUSH_AWAY_MINUTES, AGENT_PUSH_CHANNELS, AGENT_PUSH_EVENTS, LOCAL_HOST, type AgentPushChannel } from "./storage";
import { useAgentPushSettings } from "./useAgentPushSettings";
import { useRemoteCcConnect } from "./useRemoteCcConnect";

/** Settings → AI Agent → Alerts: pushing agent events to the phone with Bark or a cc-connect bot (roadmap B6.5.5). */
export function AgentPushSettings() {
  const text = useTranslation().settings.agent.push;
  const errorText = useErrorText();
  const [settings, setSettings] = useAgentPushSettings();
  const [keySaved, setKeySaved] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cc = useCcConnect();
  const bark = settings.channel === "bark";
  const remote = useRemoteCcConnect(settings.enabled && !bark && cc.enabled, settings);

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
      setStatus(errorText(error));
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
  // Every chat that gets pushes, each through its own computer's cc-connect.
  const testChats = Object.entries(settings.ccConnect)
    .filter(([host, entry]) => !settings.mutedHosts.includes(host) && !entry.viaLocal)
    .flatMap(([host, entry]) => entry.chats.map((chat) => ({ ...chat, host, path: entry.path })));
  const test = () =>
    run(
      () =>
        bark
          ? sendBarkPush(settings.server, text.testTitle, text.testBody, PUSH_GROUP)
          : Promise.all(
              testChats.map(({ host, path, project, key }) =>
                host === LOCAL_HOST
                  ? sendCcConnectMessage(cc.path, project, key, text.ccConnect.testBody)
                  : sendCcConnectRemoteMessage(host, path, project, key, `${text.ccConnect.testBody} · ${host}`),
              ),
            ),
      text.testSent,
    );
  const canTest = bark ? keySaved === true : cc.enabled && testChats.length > 0;

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
          {!bark && !cc.enabled ? <SettingsRow indent title={text.ccConnect.off} description={text.ccConnect.offHint} /> : null}
          {/* Bark with no SSH computer has only this one, which the switch above already covers. */}
          {!bark || remote.hosts.length > 0 ? (
            <CcConnectPushTargets settings={settings} onChange={setSettings} cc={cc} remote={remote} targets={!bark && cc.enabled} />
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
                description={keySaved ? text.keyIsSaved : text.keyHint}
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
