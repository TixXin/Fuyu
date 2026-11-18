import { useState } from "react";
import { CircleCheck, Copy, Download, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useErrorText, useTranslation } from "../../i18n";
import {
  changeSyncPassphrase,
  copySyncRecoveryKey,
  disableSyncEncryption,
  enableSyncEncryption,
  resetSyncRemote,
  saveSyncRecoveryKey,
  unlockSyncEncryption,
  type EncryptionState,
  type SyncStatus,
} from "./api";
import {
  SecretField,
  SyncEncryptionChangePanel,
  SyncEncryptionDisablePanel,
  SyncEncryptionEnablePanel,
  SyncEncryptionResetPanel,
  type EncryptionPanelKind,
} from "./SyncEncryptionForms";
import type { SyncSectionProps } from "./syncBackends";
import { isSyncActive } from "./syncState";

export function SyncEncryptionSection({ status, busy }: SyncSectionProps) {
  const t = useTranslation();
  const errorText = useErrorText();
  const copy = t.sync.encryption;

  const [overrideState, setOverrideState] = useState<{ base: SyncStatus; next: SyncStatus } | null>(null);
  const effectiveStatus = overrideState?.base === status ? overrideState.next : status;
  const activeBackend = isSyncActive(effectiveStatus);
  const encState: EncryptionState =
    effectiveStatus.encryption?.state ?? (effectiveStatus.phase === "locked" ? "locked" : "off");
  const keyId = effectiveStatus.encryption?.keyId ?? null;

  const [panel, setPanel] = useState<EncryptionPanelKind>("none");
  const [working, setWorking] = useState<string | null>(null);
  const [unlockSecret, setUnlockSecret] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok"; text: string } | { kind: "error"; error: unknown } | null>(null);

  const isBusy = busy || working !== null;
  const canUnlock = activeBackend && unlockSecret.trim().length > 0 && !isBusy;

  const switchPanel = (next: EncryptionPanelKind) => {
    setFeedback(null);
    setPanel(next);
  };

  const runStatusAction = async (key: string, action: () => Promise<SyncStatus>, okMessage: string) => {
    setWorking(key);
    setFeedback(null);
    try {
      const next = await action();
      setOverrideState({ base: status, next });
      setUnlockSecret("");
      setPanel("none");
      setFeedback({ kind: "ok", text: okMessage });
    } catch (error: unknown) {
      setFeedback({ kind: "error", error });
    } finally {
      setWorking(null);
    }
  };

  const handleCopyRecovery = async () => {
    setWorking("copy");
    setFeedback(null);
    try {
      await copySyncRecoveryKey();
      setFeedback({ kind: "ok", text: copy.copiedRecoveryNotice });
    } catch (error: unknown) {
      setFeedback({ kind: "error", error });
    } finally {
      setWorking(null);
    }
  };

  const handleSaveRecovery = async () => {
    setWorking("save");
    setFeedback(null);
    try {
      const savedPath = await saveSyncRecoveryKey();
      setFeedback({ kind: "ok", text: copy.savedRecoveryNotice(savedPath) });
    } catch (error: unknown) {
      setFeedback({ kind: "error", error });
    } finally {
      setWorking(null);
    }
  };

  const badgeClass =
    encState === "unlocked"
      ? "sync-badge sync-badge--ok"
      : encState === "locked"
        ? "sync-badge sync-badge--warn"
        : "sync-badge";

  const statusDescription =
    encState === "unlocked"
      ? copy.unlockedDescription
      : encState === "locked"
        ? copy.lockedDescription
        : copy.offDescription;

  return (
    <SettingsGroup title={copy.groupTitle} footer={<SettingsFootnote text={copy.footnote} />}>
      <SettingsRow
        title={
          <span className="sync-encryption__title">
            {encState === "unlocked" ? (
              <ShieldCheck size={15} strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <LockKeyhole size={15} strokeWidth={1.9} aria-hidden="true" />
            )}
            <span>{copy.rowTitle}</span>
            <span className={badgeClass}>{copy.badges[encState]}</span>
          </span>
        }
        description={
          <span className="sync-encryption__desc">
            <span>{statusDescription}</span>
            {keyId ? <span className="sync-encryption__key-id">{copy.keyIdLabel(keyId)}</span> : null}
            {!activeBackend && encState === "off" ? (
              <span className="sync-encryption__hint">{copy.needBackendHint}</span>
            ) : null}
          </span>
        }
        control={
          encState === "off" && panel !== "enable" ? (
            <button
              type="button"
              className="sync-status__button"
              disabled={!activeBackend || isBusy}
              onClick={() => switchPanel("enable")}
            >
              <span>{copy.openEnableAction}</span>
            </button>
          ) : null
        }
      />

      {encState === "off" && panel === "enable" ? (
        <SyncEncryptionEnablePanel
          copy={copy}
          showSecretLabel={t.common.showSecret}
          hideSecretLabel={t.common.hideSecret}
          activeBackend={activeBackend}
          busy={isBusy}
          working={working === "enable"}
          onCancel={() => switchPanel("none")}
          onSubmit={(pass) => void runStatusAction("enable", () => enableSyncEncryption(pass), copy.enableSuccess)}
        />
      ) : null}

      {encState === "locked" ? (
        <div className="sync-encryption__panel">
          <label className="sync-encryption__label" htmlFor="sync-enc-unlock">
            <span>{copy.unlockLabel}</span>
            <span className="sync-encryption__subhint">{copy.unlockHint}</span>
            <SecretField
              id="sync-enc-unlock"
              value={unlockSecret}
              placeholder={copy.unlockPlaceholder}
              disabled={isBusy}
              showLabel={t.common.showSecret}
              hideLabel={t.common.hideSecret}
              onChange={setUnlockSecret}
              onSubmit={() => {
                if (canUnlock) {
                  void runStatusAction("unlock", () => unlockSyncEncryption(unlockSecret.trim()), copy.unlockSuccess);
                }
              }}
            />
          </label>

          <div className="sync-encryption__actions">
            {panel !== "reset" ? (
              <SettingsLinkButton tone="danger" disabled={isBusy} onClick={() => switchPanel("reset")}>
                {copy.resetFromLockedAction}
              </SettingsLinkButton>
            ) : null}
            <button
              type="button"
              className="sync-status__button sync-status__button--primary"
              disabled={!canUnlock}
              onClick={() => void runStatusAction("unlock", () => unlockSyncEncryption(unlockSecret.trim()), copy.unlockSuccess)}
            >
              {working === "unlock" ? <LoaderCircle size={13} strokeWidth={2} className="sync-status__spinner" aria-hidden="true" /> : null}
              <span>{working === "unlock" ? copy.unlockingAction : copy.unlockSubmitAction}</span>
            </button>
          </div>
        </div>
      ) : null}

      {encState === "unlocked" ? (
        <>
          <SettingsRow
            searchable={false}
            title={
              <span className="sync-encryption__title">
                <KeyRound size={15} strokeWidth={1.9} aria-hidden="true" />
                <span>{copy.recoveryTitle}</span>
              </span>
            }
            description={copy.recoveryDescription}
          >
            <div className="sync-encryption__recovery-actions">
              <button
                type="button"
                className="sync-status__button"
                disabled={isBusy}
                onClick={() => void handleCopyRecovery()}
              >
                <Copy size={13} strokeWidth={2} aria-hidden="true" />
                <span>{copy.copyRecoveryAction}</span>
              </button>
              <button
                type="button"
                className="sync-status__button"
                disabled={isBusy}
                onClick={() => void handleSaveRecovery()}
              >
                <Download size={13} strokeWidth={2} aria-hidden="true" />
                <span>{copy.saveRecoveryAction}</span>
              </button>
            </div>
          </SettingsRow>

          {panel === "none" ? (
            <SettingsRow searchable={false} title="" className="sync-webdav__actions-row">
              <div className="sync-webdav__actions">
                <SettingsLinkButton disabled={isBusy} onClick={() => switchPanel("change")}>
                  {copy.changePassphraseAction}
                </SettingsLinkButton>
                <SettingsLinkButton tone="danger" disabled={isBusy} onClick={() => switchPanel("disable")}>
                  {copy.disableAction}
                </SettingsLinkButton>
                <SettingsLinkButton tone="danger" disabled={isBusy} onClick={() => switchPanel("reset")}>
                  {copy.resetAction}
                </SettingsLinkButton>
              </div>
            </SettingsRow>
          ) : null}
        </>
      ) : null}

      {panel === "change" && encState === "unlocked" ? (
        <SyncEncryptionChangePanel
          copy={copy}
          showSecretLabel={t.common.showSecret}
          hideSecretLabel={t.common.hideSecret}
          activeBackend={activeBackend}
          busy={isBusy}
          working={working === "change"}
          onCancel={() => switchPanel("none")}
          onSubmit={(cur, next) =>
            void runStatusAction("change", () => changeSyncPassphrase(cur, next), copy.changedPassphraseNotice)
          }
        />
      ) : null}

      {panel === "disable" && encState === "unlocked" ? (
        <SyncEncryptionDisablePanel
          copy={copy}
          showSecretLabel={t.common.showSecret}
          hideSecretLabel={t.common.hideSecret}
          activeBackend={activeBackend}
          busy={isBusy}
          working={working === "disable"}
          onCancel={() => switchPanel("none")}
          onSubmit={(sec) => void runStatusAction("disable", () => disableSyncEncryption(sec), copy.disabledNotice)}
        />
      ) : null}

      {panel === "reset" ? (
        <SyncEncryptionResetPanel
          copy={copy}
          showSecretLabel={t.common.showSecret}
          hideSecretLabel={t.common.hideSecret}
          activeBackend={activeBackend}
          busy={isBusy}
          working={working === "reset"}
          onCancel={() => switchPanel("none")}
          onSubmit={(pass) => void runStatusAction("reset", () => resetSyncRemote(pass), copy.resetDoneNotice)}
        />
      ) : null}

      {feedback ? (
        <div className="sync-encryption__feedback-wrap">
          {feedback.kind === "ok" ? (
            <p className="sync-webdav__feedback sync-webdav__feedback--ok" role="status">
              <CircleCheck size={14} strokeWidth={2} aria-hidden="true" />
              <span>{feedback.text}</span>
            </p>
          ) : (
            <p className="sync-status__error" role="alert">
              {errorText(feedback.error)}
            </p>
          )}
        </div>
      ) : null}
    </SettingsGroup>
  );
}
