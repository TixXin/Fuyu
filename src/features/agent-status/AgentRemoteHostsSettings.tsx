import { useId, useState } from "react";
import { CirclePlus, Server, Trash2 } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useFlash } from "../../components/settings/useFlash";
import { useTranslation } from "../../i18n";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../plugin-kernel/settingsSlots";
import { RemoteHostForm } from "./RemoteHostForm";
import { customAddress, useRemoteHosts, type RemoteHostEntry } from "./useRemoteHosts";
import "./AgentRemoteHostsSettings.css";

function RemoteHostsSection() {
  const text = useTranslation().settings.agent;
  const remote = useRemoteHosts();
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, flashRefreshed] = useFlash<true>();
  const refresh = async () => {
    setRefreshing(true);
    flashRefreshed(null);
    const ok = await remote.refresh();
    setRefreshing(false);
    if (ok) flashRefreshed(true);
  };
  const refreshLabel = refreshing ? text.remoteRefreshing : refreshed ? text.remoteRefreshed : text.remoteRefresh;

  return (
    <>
      <SettingsGroup>
        <div className="agent-remote__intro">
          <span className="agent-remote__icon" aria-hidden="true">
            <Server size={18} strokeWidth={2} />
          </span>
          <div className="agent-remote__copy">
            <p>{text.remoteIntro}</p>
            <SettingsFootnote text={text.remoteRequirements} />
          </div>
        </div>
      </SettingsGroup>
      <SettingsGroup
        title={text.remoteHostsSection}
        action={remote.entries.some((entry) => entry.status) ? <SettingsLinkButton disabled={refreshing} onClick={() => void refresh()}><span role="status">{refreshLabel}</span></SettingsLinkButton> : undefined}
        footer={remote.error ? <span className="agent-remote__error">{remote.error}</span> : text.remoteHostsFooter}
      >
        {remote.loaded && remote.entries.length === 0 ? <SettingsRow searchable={false} title={text.remoteEmpty} description={text.remoteEmptyHint} /> : null}
        {remote.entries.map((entry) => (
          <HostRow key={entry.name} entry={entry} onToggle={(on) => remote.toggle(entry.name, on)} onRemove={() => remote.remove(entry.name)} />
        ))}
        {adding ? (
          <div className="agent-remote__adding">
            <RemoteHostForm onAdd={remote.add} onCancel={() => setAdding(false)} />
            <p className="agent-remote__hint">{text.remoteAddHint}</p>
          </div>
        ) : (
          <button className="agent-remote__add" type="button" onClick={() => setAdding(true)}>
            <CirclePlus size={16} strokeWidth={2} aria-hidden="true" />
            {text.remoteAdd}
          </button>
        )}
      </SettingsGroup>
    </>
  );
}

const sections = settingsSections<Record<never, never>, "agentRemote">();

sections.add({ id: "agentRemote.hosts", category: "agentRemote", order: 10, component: RemoteHostsSection });

export function AgentRemoteHostsSettings() {
  return <SlotView slot={sections} group="agentRemote" />;
}

function HostRow({ entry, onToggle, onRemove }: { entry: RemoteHostEntry; onToggle: (on: boolean) => void; onRemove: () => void }) {
  const text = useTranslation().settings.agent;
  const id = useId();
  const { status } = entry;
  const origin = entry.custom ? customAddress(entry.custom) : text.remoteFromConfig;
  const dotTone = status === null ? "off" : status.error ? "error" : status.fetching ? "busy" : "ok";
  let state: string | null = null;
  if (status?.error) state = text.remoteFailed(status.error);
  else if (status?.fetchedAt != null) state = text.remoteFetchedAt(new Date(status.fetchedAt).toLocaleTimeString(), status.sessions ?? 0);
  else if (status) state = text.remoteFetching;
  return (
    <SettingsRow
      searchable={false}
      title={
        <span className="agent-remote__host-title">
          <span className={`agent-remote__dot agent-remote__dot--${dotTone}`} aria-hidden="true" />
          {entry.name}
        </span>
      }
      labelFor={id}
      description={
        <>
          <span className="agent-remote__origin">{origin}</span>
          {state ? <span className={status?.error ? "agent-remote__state agent-remote__error" : "agent-remote__state"}>{state}</span> : null}
          {status?.approvalError && !status.error ? <span className="agent-remote__state agent-remote__error">{text.remoteApprovalFailed(status.approvalError)}</span> : null}
        </>
      }
      control={
        <>
          {entry.custom ? (
            <button className="agent-remote__remove" type="button" aria-label={text.remoteRemove(entry.name)} title={text.remoteRemove(entry.name)} onClick={onRemove}>
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
          <SettingsSwitch id={id} checked={status !== null} onChange={onToggle} />
        </>
      }
    />
  );
}
