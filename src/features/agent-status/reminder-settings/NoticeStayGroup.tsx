import type { MouseEvent } from "react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { useTranslation } from "../../../i18n";
import { AGENT_ALERT_SECONDS } from "../../../lib/settings/settings";
import type { IslandSettings } from "../../../lib/settings/types";
import { AGENT_NOTICE_FAILED_SECONDS, AGENT_NOTICE_YOUR_TURN_SECONDS, AGENT_REMIND_SECONDS } from "../agentSettings";
import { PREVIEW_EVENTS, type PreviewEvent } from "./previewEvents";
import "./NoticeStayGroup.css";

type SecondsKey = "agentAlertSeconds" | "agentNoticeYourTurnSeconds" | "agentNoticeFailedSeconds" | "agentRemindSeconds";

export function NoticeStayGroup({
  settings,
  event,
  onUpdate,
  onSelect,
}: {
  settings: IslandSettings;
  event: PreviewEvent;
  onUpdate: (patch: Partial<IslandSettings>) => void;
  onSelect: (event: PreviewEvent) => void;
}) {
  const t = useTranslation();
  const text = t.settings.agentNotice;
  const alerts = t.settings.agent.alerts;

  const rowClass = (name: PreviewEvent) => `agent-reminder-row agent-reminder-row--${name}${name === event ? " agent-reminder-row--active" : ""}`;
  const stay = (value: number) => (value === 0 ? text.untilSeen : text.closeAfter(value));

  const seconds = (key: SecondsKey, title: string, values: readonly number[], label: (value: number) => string) => (
    <SettingsSelect
      value={String(settings[key])}
      options={values.map((value) => ({ value: String(value), label: label(value) }))}
      ariaLabel={title}
      onChange={(value) => onUpdate({ [key]: Number(value) })}
    />
  );

  const pick = (click: MouseEvent<HTMLDivElement>) => {
    if (!(click.target instanceof Element) || click.target.closest(".settings-row__control")) return;
    const row = click.target.closest(".agent-reminder-row");
    const name = row && PREVIEW_EVENTS.find((candidate) => row.classList.contains(`agent-reminder-row--${candidate}`));
    if (name) onSelect(name);
  };

  return (
    <div className="agent-reminder-rows" onClick={pick}>
      <SettingsGroup title={text.stayTitle}>
        <SettingsRow
          className={rowClass("approval")}
          title={text.stayApproval}
          control={<span className="agent-reminder-row__fixed">{text.stayHandled}</span>}
        />
        <SettingsRow
          indent
          title={alerts.remind}
          description={alerts.remindDescription}
          control={seconds("agentRemindSeconds", alerts.remind, AGENT_REMIND_SECONDS, alerts.remindValue)}
        />
        <SettingsRow
          className={rowClass("yourTurn")}
          title={text.yourTurn}
          description={text.yourTurnHint}
          control={seconds("agentNoticeYourTurnSeconds", text.yourTurn, AGENT_NOTICE_YOUR_TURN_SECONDS, stay)}
        />
        <SettingsRow
          className={rowClass("done")}
          title={text.completed}
          control={seconds("agentAlertSeconds", text.completed, AGENT_ALERT_SECONDS, text.closeAfter)}
        />
        <SettingsRow
          className={rowClass("failed")}
          title={text.failed}
          control={seconds("agentNoticeFailedSeconds", text.failed, AGENT_NOTICE_FAILED_SECONDS, stay)}
        />
      </SettingsGroup>
    </div>
  );
}
