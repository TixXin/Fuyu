import { Fragment } from "react";
import { SettingsInput } from "../../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { CC_CONNECT_AGENT_LABELS, chatLabel, type CcConnectProject, type useCcConnect } from "../../cc-connect";
import { LOCAL_HOST, pushHost, type AgentPushSettings, type CcConnectPushHost } from "./storage";
import type { useRemoteCcConnect } from "./useRemoteCcConnect";

type Props = {
  settings: AgentPushSettings;
  onChange: (settings: AgentPushSettings) => void;
  cc: ReturnType<typeof useCcConnect>;
  remote: ReturnType<typeof useRemoteCcConnect>;
  /** Whether the channel is cc-connect, so each computer's bots are listed under it. */
  targets: boolean;
};

/**
 * Settings → AI Agent → Alerts → Phone push, by computer: this one, then each SSH computer whose
 * sessions the island reads. Each has a switch for pushing its sessions; with the cc-connect
 * channel, the chats of its own cc-connect's projects (any number, of any agent) to push to.
 */
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
  const program = status?.exe ? (status.running ? status.exe : `${status.exe} · ${text.notRunning}`) : `${text.notFound}: ${text.notFoundHint}`;
  return (
    <>
      <SettingsRow
        indent
        searchable={false}
        title={text.program}
        description={state?.reading ? text.reading : (state?.error ?? (status ? program : text.programHint))}
        control={<SettingsLinkButton disabled={state?.reading} onClick={() => void remote.read(host)}>{text.refresh}</SettingsLinkButton>}
      >
        <SettingsInput
          monospace
          value={entry.path}
          placeholder={text.programHint}
          aria-label={text.program}
          onChange={(event) => onChange({ ...entry, path: event.target.value })}
        />
      </SettingsRow>
      {(status && !status.exe) || entry.viaLocal ? (
        <SettingsToggleRow indent title={text.viaLocal} description={text.viaLocalHint} checked={entry.viaLocal} onChange={(viaLocal) => onChange({ ...entry, viaLocal })} />
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
  if (projects.length === 0) {
    return <SettingsRow indent searchable={false} title={text.noProjects} description={error ?? undefined} control={<SettingsLinkButton onClick={onRefresh}>{text.refresh}</SettingsLinkButton>} />;
  }
  const picked = (project: string, key: string) => entry.chats.some((chat) => chat.project === project && chat.key === key);
  const toggle = (project: CcConnectProject, key: string, on: boolean) =>
    onChange({
      ...entry,
      chats: on
        ? [...entry.chats, { project: project.name, key, agent: project.agent }]
        : entry.chats.filter((chat) => chat.project !== project.name || chat.key !== key),
    });
  return (
    <>
      {projects.map((project) => (
        <Fragment key={project.name}>
          <SettingsRow
            indent
            searchable={false}
            title={text.project(project.name, project.agent ? (CC_CONNECT_AGENT_LABELS[project.agent] ?? project.agent) : "?")}
            description={error ?? text.projectHint}
          />
          {project.chats.map((chat) => (
            <SettingsToggleRow
              key={chat.key}
              indent
              title={chatLabel(chat, t.plugins.ccConnect.platforms)}
              description={chat.key}
              checked={picked(project.name, chat.key)}
              onChange={(on) => toggle(project, chat.key, on)}
            />
          ))}
        </Fragment>
      ))}
    </>
  );
}
