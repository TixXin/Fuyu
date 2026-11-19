import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { AGENT_REMIND_SECONDS } from "./agentSettings";

export function AgentAlertSettings({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.agent.alerts;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const remindOptions = AGENT_REMIND_SECONDS.map((seconds) => ({ value: String(seconds), label: text.remindValue(seconds) }));

  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.hint} />}>
      <SettingsToggleRow title={text.waiting} checked={settings.agentAlertWaiting} onChange={(agentAlertWaiting) => update({ agentAlertWaiting })} />
      {settings.agentAlertWaiting && (
        <SettingsRow
          indent
          title={text.remind}
          description={text.remindDescription}
          control={
            <SettingsSelect
              value={String(settings.agentRemindSeconds)}
              options={remindOptions}
              ariaLabel={text.remind}
              onChange={(value) => update({ agentRemindSeconds: Number(value) })}
            />
          }
        />
      )}
      <SettingsToggleRow title={text.completed} checked={settings.agentAlertCompleted} onChange={(agentAlertCompleted) => update({ agentAlertCompleted })} />
      <SettingsToggleRow title={text.failed} checked={settings.agentAlertFailed} onChange={(agentAlertFailed) => update({ agentAlertFailed })} />
  </SettingsGroup>
);
}
