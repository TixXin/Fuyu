import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { SelectControl } from "../../components/controls/SelectControl";
import { useErrorText, useTranslation } from "../../i18n";
import { installCcConnect, type CcConnectStatus } from "./api";
import { chatsOf, InfoRow, projectLabel } from "./CcConnectInfo";
import { CcConnectRemote } from "./CcConnectRemote";
import { CcConnectSetup } from "./CcConnectSetup";
import { useCcConnect } from "./useCcConnect";
import { useRemoteCcConnect } from "./useRemoteCcConnect";

export function CcConnectSection() {
  const t = useTranslation().settings.plugins.ccConnect;
  const cc = useCcConnect();
  const errorText = useErrorText();
  const { enabled, status, error, refresh } = cc;
  const [host, setHost] = useState("");
  const remote = useRemoteCcConnect(enabled && host !== "");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  if (!enabled) return null;

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await installCcConnect();
      await refresh();
    } catch (reason) {
      setDownloadError(errorText(reason));
    } finally {
      setDownloading(false);
    }
  };
  const hosts = [{ value: "", label: t.thisComputer }, ...remote.hosts.map((name) => ({ value: name, label: name }))];

  return (
    <>
      <section className="settings-section plugins-panel">
        <div className="settings-section__header">
          <span>{t.title}</span>
          <button className="plugin-card__button" type="button" onClick={() => void (host ? remote.read(host) : refresh())} aria-label={t.refresh} title={t.refresh}>
            <RefreshCw size={12} strokeWidth={2.4} />
          </button>
        </div>
        <p className="settings-section__hint">{t.hint}</p>
        {remote.hosts.length > 0 ? (
          <div className="plugin-setting">
            <label className="plugin-setting__row">
              <span>{t.computer}</span>
              <SelectControl value={host} options={hosts} ariaLabel={t.computer} onChange={setHost} />
            </label>
          </div>
        ) : null}
        {host ? (
          <CcConnectRemote host={host} remote={remote} />
        ) : (
          <>
            {status ? <LocalStatus status={status} downloading={downloading} onDownload={() => void download()} /> : null}
            {downloadError ? <p className="plugin-card__error">{downloadError}</p> : null}
            {error ? <p className="plugin-card__error">{error}</p> : null}
          </>
        )}
      </section>
      {host ? null : <CcConnectSetup cc={cc} />}
    </>
  );
}

function LocalStatus({ status, downloading, onDownload }: { status: CcConnectStatus; downloading: boolean; onDownload: () => void }) {
  const t = useTranslation().settings.plugins.ccConnect;
  const errorText = useErrorText();
  return (
    <>
      <div className="plugin-info">
        {status.exe ? <InfoRow label={t.program} value={`${status.exe} · ${t.source[status.exeSource ?? "path"]}`} /> : null}
        {status.exe && status.running ? <InfoRow label={t.state} value={t.running} /> : null}
        {status.runner !== "off" ? (
          <InfoRow label={t.runnerLabel} value={[t.runner[status.runner], status.runnerError && errorText(status.runnerError)].filter(Boolean).join(" · ")} />
        ) : null}
        {projectNames(status).map((name) => (
          <InfoRow key={name} label={projectLabel(status.projects, name)} value={chatsOf(status.projects, name, t.platforms) || t.noChats} />
        ))}
      </div>
      {status.exe ? null : (
        <>
          <p className="plugin-card__error">{status.exeError ? errorText(status.exeError) : t.notFound}</p>
          <p className="settings-section__hint">{t.downloadHint}</p>
          <div>
            <button className="plugin-card__button" type="button" disabled={downloading} onClick={onDownload}>
              {downloading ? t.downloading : t.download}
            </button>
          </div>
        </>
      )}
      {status.exe && !status.running && status.runner === "off" ? <p className="plugin-card__error">{t.notRunning}</p> : null}
      {status.projects.length === 0 ? <p className="settings-section__hint">{t.noProjects}</p> : null}
    </>
  );
}

function projectNames(status: CcConnectStatus) {
  return [...new Set([...status.configProjects, ...status.projects.map((project) => project.name)])];
}
