import { Fragment, useState } from "react";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { CC_CONNECT_AGENT_LABELS, chatLabel, type CcConnectProject, type useCcConnect, type useRemoteCcConnect } from "../../cc-connect";
import { LOCAL_HOST, pushHost, type AgentPushSettings, type CcConnectPushHost } from "./storage";

type Props = {
  settings: AgentPushSettings;
  onChange: (settings: AgentPushSettings) => void;
  cc: ReturnType<typeof useCcConnect>;
  remote: ReturnType<typeof useRemoteCcConnect>;
  targets: boolean;
};

export function CcConnectPushTargets({ settings, onChange, cc, remote, targets }: Props) {
  const text = useTranslation().settings.agent.push.ccConnect;
  const setHost = (host: string, entry: CcConnectPushHost) => onChange({ ...settings, ccConnect: { ...settings.ccConnect, [host]: entry } });
  const mute = (host: string, on: boolean) =>
    onChange({ ...settings, mutedHosts: on ? settings.mutedHosts.filter((muted) => muted !== host) : [...settings.mutedHosts, host] });

  return (
    <>
      {[LOCAL_HOST, ...remote.hosts].map((host) => {
        const on = !settings.mutedHosts.includes(host);
        const entry = pushHost(settings, host);
        const change = (next: CcConnectPushHost) => setHost(host, next);
        return (
          <Fragment key={host}>
            <SettingsToggleRow indent searchable={false} title={host || text.thisComputer} description={text.hostHint} checked={on} onChange={(next) => mute(host, next)} />
            {on && targets && host === LOCAL_HOST ? (
              <ProjectChats projects={cc.status?.projects ?? []} error={cc.error} entry={entry} onChange={change} onRefresh={() => void cc.refresh()} />
            ) : null}
            {on && targets && host !== LOCAL_HOST ? <RemoteTargets host={host} entry={entry} onChange={change} remote={remote} /> : null}
          </Fragment>
        );
      })}
    </>
  );
}

function RemoteTargets({ host, entry, onChange, remote }: { host: string; entry: CcConnectPushHost; onChange: (entry: CcConnectPushHost) => void; remote: Props["remote"] }) {
  const text = useTranslation().settings.agent.push.ccConnect;
  const state = remote.entries[host];
  const status = state?.status ?? null;
  const found = status?.exe ? (status.running ? status.exe : `${status.exe} · ${text.notRunning}`) : `${text.notFound}: ${text.notFoundHint}`;
  return (
    <>
      {state?.reading || state?.error || !status?.exe || !status.running ? (
        <SettingsRow
          indent={2}
          searchable={false}
          title={text.program}
          description={state?.reading ? text.reading : (state?.error ?? (status ? found : undefined))}
          control={<SettingsLinkButton disabled={state?.reading} onClick={() => void remote.read(host)}>{text.refresh}</SettingsLinkButton>}
        />
      ) : null}
      {(status && !status.exe) || entry.viaLocal ? (
        <SettingsToggleRow indent={2} searchable={false} title={text.viaLocal} description={text.viaLocalHint} checked={entry.viaLocal} onChange={(viaLocal) => onChange({ ...entry, viaLocal })} />
      ) : null}
      {status?.exe && !entry.viaLocal ? (
        <ProjectChats projects={status.projects} error={null} entry={entry} onChange={onChange} onRefresh={() => void remote.read(host)} />
      ) : null}
    </>
  );
}

function ProjectChats({
  projects,
  error,
  entry,
  onChange,
  onRefresh,
}: {
  projects: CcConnectProject[];
  error: string | null;
  entry: CcConnectPushHost;
  onChange: (entry: CcConnectPushHost) => void;
  onRefresh: () => void;
}) {
  const t = useTranslation().settings;
  const text = t.agent.push.ccConnect;
  const [shown, setShown] = useState<string | null>(null);
  if (projects.length === 0) {
    return <SettingsRow indent={2} searchable={false} title={text.noProjects} description={error ?? undefined} control={<SettingsLinkButton onClick={onRefresh}>{text.refresh}</SettingsLinkButton>} />;
  }
  const pickedIn = (name: string) => entry.chats.filter((chat) => chat.project === name).length;
  const project = projects.find((each) => each.name === shown) ?? projects.find((each) => pickedIn(each.name) > 0) ?? projects[0];
  const label = (each: CcConnectProject) => {
    const name = text.project(each.name, each.agent ? (CC_CONNECT_AGENT_LABELS[each.agent] ?? each.agent) : "?");
    const picked = pickedIn(each.name);
    return picked > 0 ? `${name} · ${text.picked(picked)}` : name;
  };
  const toggle = (key: string, on: boolean) =>
    onChange({
      ...entry,
      chats: on
        ? [...entry.chats, { project: project.name, key, agent: project.agent }]
        : entry.chats.filter((chat) => chat.project !== project.name || chat.key !== key),
    });
  return (
    <>
      <SettingsRow
        indent={2}
        searchable={false}
        title={text.projectTitle}
        description={error ?? text.projectHint}
        control={<SettingsSelect value={project.name} options={projects.map((each) => ({ value: each.name, label: label(each) }))} ariaLabel={text.projectTitle} onChange={setShown} />}
      />
      {project.chats.map((chat) => (
        <SettingsToggleRow
          key={chat.key}
          indent={3}
          searchable={false}
          title={chatLabel(chat, t.plugins.ccConnect.platforms)}
          description={chat.key}
          checked={entry.chats.some((each) => each.project === project.name && each.key === chat.key)}
          onChange={(on) => toggle(chat.key, on)}
        />
      ))}
      {project.chats.length === 0 ? (
        <SettingsRow indent={3} searchable={false} title={text.noChats} control={<SettingsLinkButton onClick={onRefresh}>{text.refresh}</SettingsLinkButton>} />
      ) : null}
    </>
  );
}
