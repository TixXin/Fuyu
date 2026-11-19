import type { MouseEvent } from "react";
import { Volume2 } from "lucide-react";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import { useTranslation } from "../../../i18n";
import { AGENT_ALERT_SECONDS } from "../../../lib/settings/settings";
import type { IslandSettings } from "../../../lib/settings/types";
import { AGENT_ALERT_STARTED, AGENT_NOTICE_FAILED_SECONDS, AGENT_NOTICE_YOUR_TURN_SECONDS, AGENT_REMIND_SECONDS } from "../agentSettings";
import { PREVIEW_EVENTS, PREVIEW_SOUND, type PreviewEvent, type PreviewSwitch } from "./previewEvents";
import "./ReminderEventRows.css";

type SecondsKey = "agentAlertSeconds" | "agentNoticeYourTurnSeconds" | "agentNoticeFailedSeconds" | "agentRemindSeconds";

export function ReminderEventRows({
  settings,
  event,
  onUpdate,
  onSelect,
  onAudition,
}: {
  settings: IslandSettings;
  event: PreviewEvent;
  onUpdate: (patch: Partial<IslandSettings>) => void;
  onSelect: (event: PreviewEvent) => void;
  onAudition: (event: PreviewEvent) => void;
}) {
  const t = useTranslation();
  const text = t.settings.agentNotice;
  const alerts = t.settings.agent.alerts;
  const sounds = t.settings.sounds.events;

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

  const audition = (name: PreviewEvent) => {
    const label = text.audition(sounds[PREVIEW_SOUND[name]].title);
    return (
      <button className="agent-reminder-row__audition" type="button" aria-label={label} title={label} onClick={() => onAudition(name)}>
        <Volume2 size={14} strokeWidth={2.2} aria-hidden="true" />
      </button>
    );
  };

  const toggle = (key: PreviewSwitch, label: string) => (
    <SettingsSwitch id={`agent-reminder-${key}`} checked={settings[key]} ariaLabel={label} onChange={(checked) => onUpdate({ [key]: checked })} />
  );

  const pick = (click: MouseEvent<HTMLDivElement>) => {
    if (!(click.target instanceof Element) || click.target.closest(".settings-row__control")) return;
    const row = click.target.closest(".agent-reminder-row");
    const name = row && PREVIEW_EVENTS.find((candidate) => row.classList.contains(`agent-reminder-row--${candidate}`));
    if (name) onSelect(name);
  };

  return (
    <div className="agent-reminder-rows" onClick={pick}>
      <SettingsGroup title={text.eventsTitle} footer={<SettingsFootnote text={`${text.eventsFooter} ${alerts.hint}`} />}>
        <SettingsRow
          className={rowClass("approval")}
          title={alerts.waiting}
          control={
            <div className="agent-reminder-row__controls">
              <span className="agent-reminder-row__fixed">{text.stayHandled}</span>
              {audition("approval")}
              {toggle("agentAlertWaiting", alerts.waiting)}
            </div>
          }
        />
        {settings.agentAlertWaiting && (
          <SettingsRow
            indent
            title={alerts.remind}
            description={alerts.remindDescription}
            control={seconds("agentRemindSeconds", alerts.remind, AGENT_REMIND_SECONDS, alerts.remindValue)}
          />
        )}
        {settings.agentAlertWaiting && (
          <SettingsRow
            indent
            className={rowClass("yourTurn")}
            title={text.yourTurn}
            description={text.yourTurnHint}
            control={
              <div className="agent-reminder-row__controls">
                {seconds("agentNoticeYourTurnSeconds", text.yourTurn, AGENT_NOTICE_YOUR_TURN_SECONDS, stay)}
                {audition("yourTurn")}
              </div>
            }
          />
        )}
        <SettingsRow
          className={rowClass("done")}
          title={alerts.completed}
          control={
            <div className="agent-reminder-row__controls">
              {seconds("agentAlertSeconds", text.completed, AGENT_ALERT_SECONDS, text.closeAfter)}
              {audition("done")}
              {toggle("agentAlertCompleted", alerts.completed)}
            </div>
          }
        />
        <SettingsRow
          className={rowClass("failed")}
          title={alerts.failed}
          control={
            <div className="agent-reminder-row__controls">
              {seconds("agentNoticeFailedSeconds", text.failed, AGENT_NOTICE_FAILED_SECONDS, stay)}
              {audition("failed")}
              {toggle("agentAlertFailed", alerts.failed)}
            </div>
          }
        />
        <SettingsRow
          className={rowClass("started")}
          title={text.started}
          control={
            <div className="agent-reminder-row__controls">
              <SettingsSelect
                value={settings.agentAlertStarted}
                options={AGENT_ALERT_STARTED.map((value) => ({ value, label: text.startedOptions[value] }))}
                ariaLabel={text.started}
                onChange={(agentAlertStarted) => onUpdate({ agentAlertStarted })}
              />
              {audition("started")}
            </div>
          }
        />
      </SettingsGroup>
    </div>
  );
}
