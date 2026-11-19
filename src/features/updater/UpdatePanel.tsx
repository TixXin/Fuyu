import { useEffect, useSyncExternalStore } from "react";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { useDevBuild } from "../../lib/platform";
import { websitePage } from "./projectLinks";
import { useOpenInBrowser } from "./useOpenInBrowser";
import { useRestartStalled } from "./useRestartStalled";
import { restartIsland } from "../../lib/settings-backup/api";
import { useDownloadSource } from "./useDownloadSource";
import {
  checkForUpdate,
  checkOnFirstVisit,
  getUpdateState,
  installUpdate,
  skipVersion,
  subscribeToUpdate,
  type UpdateStage,
} from "./updaterController";
import "./UpdatePanel.css";

type Tone = "muted" | "ok" | "new" | "busy" | "error";

const TONES: Record<Exclude<UpdateStage, "disabled">, Tone> = {
  idle: "muted", checking: "busy", latest: "ok", available: "new", downloading: "busy",
  ready: "new", installing: "busy", done: "ok", error: "error",
};

function LatestReleaseLink() {
  const t = useTranslation();
  const { locale } = useLocale();
  const { failed, onClick } = useOpenInBrowser();
  return (
    <>
      <a className="update-status__link" href={websitePage(locale, "releases/")} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {t.settings.project.latestRelease} ↗
      </a>
      {failed && <span className="update-status__error" role="alert">{t.settings.project.openFailed}</span>}
    </>
  );
}

export function UpdatePanel() {
  const t = useTranslation();
  const text = t.settings.project.update;
  const devBuild = useDevBuild();
  const hero = t.settings.project.hero;
  const errorText = useErrorText();
  const { stage, version, channel, nextVersion, downloaded, total, detail, errorKind, skippedVersion, commandError, autoUpdate } = useSyncExternalStore(
    subscribeToUpdate,
    getUpdateState,
  );

  const downloadSource = useDownloadSource();

  useEffect(() => {
    void checkOnFirstVisit();
  }, []);

  const restartStalled = useRestartStalled(stage);
  const installFailed = stage === "error" && errorKind === "install";

  if (stage === "disabled") {
    return (
      <div className="update-status update-status--muted">
        <div className="update-status__row update-status__row--solo">
          <span className="update-status__dot" aria-hidden="true" />
          <strong className="update-status__headline" role="status">{devBuild ? hero.devIsland : text.manualOnly}</strong>
        </div>
        <p className="update-status__sub">
          <span>{devBuild ? t.settings.devBuild.updateOff : text.unavailable}</span>
          <LatestReleaseLink />
        </p>
      </div>
    );
  }

  const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null;
  const skipped = nextVersion !== "" && skippedVersion === nextVersion;
  const current = version ? text.versionLabel(version) : "";
  const install = () => void installUpdate(nextVersion, channel);
  const step = version ? `v${version} → v${nextVersion}` : `v${nextVersion}`;

  let headline = current || text.title;
  let sub = hero.idle;
  if (stage === "checking") { headline = text.checking; sub = current; }
  else if (stage === "latest") { headline = text.upToDate; sub = current; }
  else if (stage === "available") { headline = text.available(nextVersion); sub = skipped ? text.skipped(nextVersion) : current; }
  else if (stage === "downloading") { headline = percent === null ? text.downloadingUnknown : text.downloading(percent); sub = step; }
  else if (stage === "ready") { headline = hero.ready(nextVersion); sub = skipped ? text.skipped(nextVersion) : autoUpdate === "install" ? text.readyIdleHint : text.readyHint; }
  else if (stage === "installing") { headline = text.installing; sub = `${step} · ${text.readyHint}`; }
  else if (stage === "done" && restartStalled) { headline = text.restartStalled; sub = text.restartStalledHint; }
  else if (stage === "done") { headline = text.done; sub = current; }
  else if (stage === "error") { headline = installFailed ? hero.installError : hero.error; sub = detail ? text.errorDetail(detail) : text.error; }

  const offersUpdate = stage === "available" || stage === "ready";
  const showsSource = downloadSource !== null && (stage === "downloading" || stage === "ready" || stage === "installing" || stage === "done");
  const primary = offersUpdate ? (
    <button className="update-status__button update-status__button--primary" type="button" onClick={install}>
      {stage === "ready" ? text.installNow : text.download}
    </button>
  ) : stage === "idle" || stage === "latest" || stage === "error" || stage === "checking" ? (
    <button className="update-status__button" type="button" disabled={stage === "checking"} onClick={() => void checkForUpdate()}>
      {stage === "error" ? (installFailed ? text.recheck : text.retry) : text.title}
    </button>
  ) : restartStalled ? (
    <button className="update-status__button update-status__button--primary" type="button" onClick={() => void restartIsland().catch((error: unknown) => console.error(error))}>
      {text.restartNow}
    </button>
  ) : null;

  return (
    <div className={`update-status update-status--${TONES[stage]}`}>
      <div className={primary ? "update-status__row" : "update-status__row update-status__row--solo"}>
        <span className="update-status__dot" aria-hidden="true" />
        <strong className="update-status__headline" role={stage === "error" ? "alert" : "status"}>{headline}</strong>
        {primary}
      </div>
      {(stage === "downloading" || stage === "installing") && (
        <div
          className={percent === null ? "update-status__track update-status__track--unknown" : "update-status__track"}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
        >
          <span className="update-status__fill" style={percent === null ? undefined : { transform: `scaleX(${percent / 100})` }} />
        </div>
      )}
      <p className="update-status__sub">
        {sub ? <span>{sub}</span> : null}
        {showsSource ? <span>{text.downloadSource(downloadSource)}</span> : null}
        {offersUpdate ? (
          <span title={skipped ? undefined : text.skipHint}>
            <SettingsLinkButton onClick={() => skipVersion(skipped ? null : nextVersion)}>{skipped ? text.unskip : text.skip}</SettingsLinkButton>
          </span>
        ) : null}
        {stage === "available" ? <SettingsLinkButton onClick={() => void checkForUpdate()}>{text.recheck}</SettingsLinkButton> : null}
      </p>
      {commandError !== null && <p className="update-status__error" role="alert">{errorText(commandError)}</p>}
    </div>
  );
}
