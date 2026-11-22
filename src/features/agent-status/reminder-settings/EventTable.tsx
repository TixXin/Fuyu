import type { MouseEvent, ReactNode } from "react";
import { Monitor, Play, Smartphone, Volume2, type LucideIcon } from "lucide-react";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { AGENT_ALERT_STARTED, AGENT_QUOTA_ALERT_PERCENTS } from "../agentSettings";
import type { AgentPushSettings } from "../push/storage";
import type { AgentSoundEvent } from "../sounds/events";
import type { AgentSoundSettings } from "../sounds/storage";
import type { PreviewEvent } from "./previewEvents";
import { TABLE_ROWS, tableRowOf, type TableRow } from "./tableEvents";
import "./EventTable.css";

export type AlertChannelPage = "sounds" | "agentPush";

function Head({ icon: Icon, label, status, off, link, onLink }: {
  icon: LucideIcon;
  label: string;
  status?: string;
  off?: boolean;
  link?: string;
  onLink?: () => void;
}) {
  return (
    <th scope="col" className={`agent-event-table__head${off ? " agent-event-table__head--off" : ""}`}>
      <span className="agent-event-table__name" title={label}>
        <Icon className="agent-event-table__icon" size={15} strokeWidth={2} aria-hidden="true" />
        <span className="agent-event-table__label">{label}</span>
      </span>
      <span className="agent-event-table__sub">
        {status ? <span className="agent-event-table__status">{status}{link && onLink ? " ·" : ""}</span> : null}
        {link && onLink ? <button className="agent-event-table__go" type="button" onClick={onLink}>{link}</button> : null}
      </span>
    </th>
  );
}

export function EventTable({
  settings,
  event,
  sounds,
  push,
  onUpdate,
  onSounds,
  onPush,
  onSelect,
  onAudition,
  onShowPage,
}: {
  settings: IslandSettings;
  event: PreviewEvent;
  sounds: AgentSoundSettings;
  push: AgentPushSettings;
  onUpdate: (patch: Partial<IslandSettings>) => void;
  onSounds: (events: AgentSoundSettings["events"]) => void;
  onPush: (events: AgentPushSettings["events"]) => void;
  onSelect: (event: PreviewEvent) => void;
  onAudition: (sound: AgentSoundEvent) => void;
  onShowPage?: (page: AlertChannelPage) => void;
}) {
  const t = useTranslation();
  const text = t.settings.agentNotice;
  const table = text.table;
  const alerts = t.settings.agent.alerts;
  const soundText = t.settings.sounds.events;
  const selected = tableRowOf(event);
  const soundOff = !sounds.enabled;
  const pushOff = !push.enabled;

  const none = <span className="agent-event-table__na" title={table.na} aria-label={table.na}>—</span>;

  const island = (row: TableRow): ReactNode => {
    const title = table.events[row.id].title;
    if (!row.island) return none;
    if (row.island.kind === "switch") {
      const key = row.island.key;
      return <SettingsSwitch id={`agent-reminder-${key}`} checked={settings[key]} ariaLabel={`${title} · ${table.columns.island}`} onChange={(checked) => onUpdate({ [key]: checked })} />;
    }
    if (row.island.kind === "started") {
      return (
        <SettingsSelect
          value={settings.agentAlertStarted}
          options={AGENT_ALERT_STARTED.map((value) => ({ value, label: text.startedOptions[value] }))}
          ariaLabel={text.started}
          onChange={(agentAlertStarted) => onUpdate({ agentAlertStarted })}
        />
      );
    }
    if (row.island.kind === "quota") {
      return (
        <SettingsSelect
          value={String(settings.agentQuotaAlertPercent)}
          options={AGENT_QUOTA_ALERT_PERCENTS.map((percent) => ({ value: String(percent), label: alerts.quotaValue(percent) }))}
          ariaLabel={alerts.quota}
          onChange={(value) => onUpdate({ agentQuotaAlertPercent: Number(value) })}
        />
      );
    }
    return <span className="agent-event-table__follow">{table.follow}</span>;
  };

  const sound = (row: TableRow) => (
    <span className="agent-event-table__sounds">
      {row.sounds.map((name) => {
        const twin = row.sounds.length > 1 ? table.twin[name as "approval" | "question"] : null;
        const label = soundText[name].title;
        const play = text.audition(label);
        return (
          <span key={name} className="agent-event-table__sound">
            {twin ? <span className="agent-event-table__twin">{twin}</span> : null}
            <SettingsSwitch
              id={`agent-sound-${name}`}
              checked={sounds.events[name]}
              disabled={soundOff}
              ariaLabel={`${label} · ${table.columns.sound}`}
              onChange={(on) => onSounds({ ...sounds.events, [name]: on })}
            />
            <button className="agent-event-table__play" type="button" disabled={soundOff} aria-label={play} title={play} onClick={() => onAudition(name)}>
              <Play size={11} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </span>
        );
      })}
    </span>
  );

  const phone = (row: TableRow) => {
    const name = row.push;
    if (!name) return none;
    return (
      <SettingsSwitch
        id={`agent-push-${name}`}
        checked={push.events[name]}
        disabled={pushOff}
        ariaLabel={`${table.events[row.id].title} · ${table.columns.push}`}
        onChange={(on) => onPush({ ...push.events, [name]: on })}
      />
    );
  };

  const pick = (row: TableRow) => (click: MouseEvent<HTMLTableRowElement>) => {
    if (!row.preview || row.id === selected) return;
    if (click.target instanceof Element && click.target.closest("button, input, label, .settings-select")) return;
    onSelect(row.preview);
  };

  const rowClass = (row: TableRow) =>
    `agent-event-table__row agent-reminder-row--${row.id}${row.preview ? " agent-event-table__row--pick" : ""}${row.id === selected ? " agent-event-table__row--active" : ""}`;
  const offClass = (off: boolean) => (off ? "agent-event-table__cell agent-event-table__cell--off" : "agent-event-table__cell");

  return (
    <SettingsGroup title={text.eventsTitle} footer={<SettingsFootnote text={`${table.footer} ${alerts.hint}`} />}>
      <div className="agent-event-table">
        <table>
          <thead>
            <tr>
              <th scope="col" className="agent-event-table__head agent-event-table__head--event">{table.columns.event}</th>
              <Head icon={Monitor} label={table.columns.island} />
              <Head
                icon={Volume2}
                label={table.columns.sound}
                off={soundOff}
                status={soundOff ? table.off : table.volume(Math.round(sounds.volume))}
                link={soundOff ? table.turnOn : table.settings}
                onLink={onShowPage && (() => onShowPage("sounds"))}
              />
              <Head
                icon={Smartphone}
                label={table.columns.push}
                off={pushOff}
                status={pushOff ? table.off : t.settings.agent.push.channels[push.channel]}
                link={pushOff ? table.turnOn : table.settings}
                onLink={onShowPage && (() => onShowPage("agentPush"))}
              />
            </tr>
          </thead>
          <tbody>
            {TABLE_ROWS.map((row) => (
              <tr key={row.id} className={rowClass(row)} onClick={pick(row)}>
                <th scope="row" className="agent-event-table__event">
                  <span className="agent-event-table__title">{table.events[row.id].title}</span>
                  <span className="agent-event-table__hint">{table.events[row.id].hint}</span>
                </th>
                <td className="agent-event-table__cell">{island(row)}</td>
                <td className={offClass(soundOff)}>{sound(row)}</td>
                <td className={offClass(pushOff)}>{phone(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsGroup>
  );
}
