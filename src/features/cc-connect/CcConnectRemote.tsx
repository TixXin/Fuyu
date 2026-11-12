import { useTranslation } from "../../i18n";
import { chatsOf, InfoRow, projectLabel } from "./CcConnectInfo";
import { useRemotePaths } from "./remotePaths";
import type { useRemoteCcConnect } from "./useRemoteCcConnect";

export function CcConnectRemote({ host, remote }: { host: string; remote: ReturnType<typeof useRemoteCcConnect> }) {
  const t = useTranslation().settings.plugins.ccConnect;
  const [paths, setPath] = useRemotePaths();
  const state = remote.entries[host];
  const status = state?.status ?? null;
  const projects = status?.projects ?? [];

  return (
    <>
      {state?.reading ? <p className="settings-section__hint">{t.reading}</p> : null}
      {status ? (
        <div className="plugin-info">
          {status.exe ? <InfoRow label={t.program} value={status.exe} /> : null}
          {status.exe && status.running ? <InfoRow label={t.state} value={t.running} /> : null}
          {projects.map((project) => (
            <InfoRow key={project.name} label={projectLabel(projects, project.name)} value={chatsOf(projects, project.name, t.platforms) || t.noChats} />
          ))}
        </div>
      ) : null}
      {status && !status.exe ? <p className="plugin-card__error">{t.notFound}</p> : null}
      {status?.exe && !status.running ? <p className="plugin-card__error">{t.remoteNotRunning}</p> : null}
      {status?.exe && projects.length === 0 ? <p className="settings-section__hint">{t.noProjects}</p> : null}
      {state?.error ? <p className="plugin-card__error">{state.error}</p> : null}
      <div className="plugin-setting">
        <label className="plugin-setting__row">
          <span>{t.remotePath}</span>
          <input className="plugin-setting__input" value={paths[host] ?? ""} spellCheck={false} onChange={(event) => setPath(host, event.currentTarget.value)} />
        </label>
        <p className="settings-section__hint">{t.remotePathHint}</p>
      </div>
      <p className="settings-section__hint">{t.remoteSetup}</p>
    </>
  );
}
