import {
  AlertTriangle,
  CircleCheck,
  CloudOff,
  FolderX,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import type { SyncPhase, SyncStatus } from "./api";

type Tone = "muted" | "ok" | "busy" | "warn" | "error";

const PHASE_TONES: Record<SyncPhase, Tone> = {
  off: "muted",
  idle: "ok",
  syncing: "busy",
  folderMissing: "warn",
  needsConfirm: "warn",
  newerVersion: "warn",
  error: "error",
};

function PhaseIcon({ phase }: { phase: SyncPhase }) {
  const props = { size: 19, strokeWidth: 1.8, "aria-hidden": true } as const;
  if (phase === "syncing") return <LoaderCircle className="sync-status__spinner" {...props} />;
  if (phase === "idle") return <CircleCheck {...props} />;
  if (phase === "folderMissing") return <FolderX {...props} />;
  if (phase === "needsConfirm") return <ShieldAlert {...props} />;
  if (phase === "newerVersion" || phase === "error") return <AlertTriangle {...props} />;
  return <CloudOff {...props} />;
}

export function SyncStatusSection({
  status,
  busy,
  actionError,
  onSyncNow,
  onConfirmDeletions,
  onStopSync,
}: {
  status: SyncStatus;
  busy: boolean;
  actionError: unknown;
  onSyncNow: () => void;
  onConfirmDeletions: () => void;
  onStopSync: () => void;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const errorText = useErrorText();
  const text = t.sync;
  const phaseCopy = text.status.phases[status.phase];
  const tone = PHASE_TONES[status.phase];
  const formattedLast = status.lastSyncAt
    ? text.status.lastSynced(new Date(status.lastSyncAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }))
    : status.folder ? text.status.neverSynced : null;
  const errorDetail = actionError !== null ? errorText(actionError) : status.lastError;
  const confirm = status.confirm;
  const confirmSummary = confirm
    ? confirm.reason === "remoteCleared"
      ? text.confirm.remoteCleared
      : text.confirm.manyDeletions(
          confirm.category ? text.categories.items[confirm.category].title : "",
          confirm.removed,
          confirm.total,
        )
    : null;

  return (
    <SettingsGroup title={text.status.groupTitle}>
      <div className={`sync-status sync-status--${tone}`}>
        <div className="sync-status__row">
          <span className="sync-status__icon">
            <PhaseIcon phase={status.phase} />
          </span>
          <div className="sync-status__copy" role={tone === "error" ? "alert" : "status"}>
            <strong>{phaseCopy.headline}</strong>
            <span>{phaseCopy.hint}</span>
            {formattedLast ? <span className="sync-status__meta">{formattedLast}</span> : null}
            {status.skippedFiles.length > 0 ? (
              <span className="sync-status__warn">{text.status.skippedFiles(status.skippedFiles.length)}</span>
            ) : null}
          </div>
          {status.folder !== null && status.phase !== "needsConfirm" ? (
            <div className="sync-status__actions">
              <button
                className="sync-status__button"
                type="button"
                disabled={busy || status.phase === "syncing"}
                onClick={onSyncNow}
              >
                <RefreshCw size={14} strokeWidth={1.9} aria-hidden="true" />
                <span>{status.phase === "syncing" ? text.status.syncingAction : text.status.syncNow}</span>
              </button>
            </div>
          ) : null}
        </div>

        {errorDetail ? (
          <p className="sync-status__error" role="alert">{errorDetail}</p>
        ) : null}

        {confirmSummary ? (
          <div className="sync-confirm" role="alertdialog" aria-label={text.confirm.title}>
            <div className="sync-confirm__body">
              <strong>{text.confirm.title}</strong>
              <p>{confirmSummary}</p>
              <span>{text.confirm.hint}</span>
            </div>
            <div className="sync-confirm__actions">
              <SettingsLinkButton tone="danger" disabled={busy} onClick={onStopSync}>
                {text.confirm.stopSync}
              </SettingsLinkButton>
              <button
                className="sync-status__button sync-status__button--primary"
                type="button"
                disabled={busy}
                onClick={onConfirmDeletions}
              >
                {text.confirm.approve}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </SettingsGroup>
  );
}
