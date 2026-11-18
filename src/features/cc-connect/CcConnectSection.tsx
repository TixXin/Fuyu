import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { useErrorText, useTranslation } from "../../i18n";
import { installCcConnect, type CcConnectStatus } from "./api";
import { chatsOf, projectLabel } from "./CcConnectInfo";
import { CcConnectRemote } from "./CcConnectRemote";
import { CcConnectSetup } from "./CcConnectSetup";
import type { useCcConnect } from "./useCcConnect";
import { useRemoteCcConnect } from "./useRemoteCcConnect";

export function CcConnectSection({ cc }: { cc: ReturnType<typeof useCcConnect> }) {
  const t = useTranslation().settings.plugins.ccConnect;
  const errorText = useErrorText();
  const { status, error, refresh } = cc;
  const [host, setHost] = useState("");
  const remote = useRemoteCcConnect(host !== "");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
      <SettingsGroup
        title={t.title}
        action={
          <SettingsLinkButton onClick={() => void (host ? remote.read(host) : refresh())}>
            <RefreshCw size={12} strokeWidth={2.2} aria-hidden="true" />
            {t.refresh}
          </SettingsLinkButton>
        }
        footer={
          <>
            <SettingsFootnote text={t.hint} />
            {downloadError ? <p className="plugin-card__error" role="alert">{downloadError}</p> : null}
            {error ? <p className="plugin-card__error" role="alert">{error}</p> : null}
          </>
        }
      >
        {remote.hosts.length > 0 ? (
          <SettingsRow
            searchable={false}
            title={t.computer}
            control={<SettingsSelect value={host} options={hosts} ariaLabel={t.computer} onChange={setHost} />}
          />
        ) : null}
        {host ? (
          <SettingsRow searchable={false} title={host}>
            <CcConnectRemote host={host} remote={remote} />
          </SettingsRow>
        ) : status ? (
          <LocalStatus status={status} downloading={downloading} onDownload={() => void download()} />
        ) : null}
      </SettingsGroup>
      {host ? null : <CcConnectSetup cc={cc} />}
    </>
  );
}

function LocalStatus({ status, downloading, onDownload }: { status: CcConnectStatus; downloading: boolean; onDownload: () => void }) {
  const t = useTranslation().settings.plugins.ccConnect;
  const errorText = useErrorText();
  const names = projectNames(status);
  return (
    <>
      {status.exe ? (
        <SettingsRow searchable={false} title={t.program} description={`${status.exe} · ${t.source[status.exeSource ?? "path"]}`} />
      ) : (
        <SettingsRow
          searchable={false}
          title={t.program}
          description={<>{status.exeError ? errorText(status.exeError) : t.notFound} · {t.downloadHint}</>}
          control={
            <SettingsLinkButton disabled={downloading} onClick={onDownload}>
              {downloading ? t.downloading : t.download}
            </SettingsLinkButton>
          }
        />
      )}
      {status.exe && status.running ? <SettingsRow searchable={false} title={t.state} description={t.running} /> : null}
      {status.exe && !status.running && status.runner === "off" ? (
        <SettingsRow searchable={false} title={t.state} description={<span className="plugin-card__error">{t.notRunning}</span>} />
      ) : null}
      {status.runner !== "off" ? (
        <SettingsRow
          searchable={false}
          title={t.runnerLabel}
          description={[t.runner[status.runner], status.runnerError && errorText(status.runnerError)].filter(Boolean).join(" · ")}
        />
      ) : null}
      {names.length === 0 ? <SettingsRow searchable={false} title={t.noProjects} /> : null}
      {names.map((name) => (
        <SettingsRow
          key={name}
          searchable={false}
          title={projectLabel(status.projects, name)}
          description={chatsOf(status.projects, name, t.platforms) || t.noChats}
        />
      ))}
    </>
  );
}

function projectNames(status: CcConnectStatus) {
  return [...new Set([...status.configProjects, ...status.projects.map((project) => project.name)])];
}
