import { useEffect, useState } from "react";
import { CircleCheck, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useErrorText, useTranslation } from "../../i18n";
import { testSyncWebdav, type SyncStatus } from "./api";
import { activeSyncBackend } from "./syncState";
import { canReuseSavedWebdavPassword, canSubmitWebdavForm } from "./webdavForm";

const CONFIRM_MS = 4_000;

type DraftState = {
  url: string | null;
  username: string | null;
  password: string;
};

type TestState =
  | { phase: "idle" }
  | { phase: "testing" }
  | { phase: "ok" }
  | { phase: "error"; error: unknown };

export function SyncWebdavSection({
  status,
  busy,
  onSaveWebdav,
  onStopSync,
}: {
  status: SyncStatus;
  busy: boolean;
  onSaveWebdav: (url: string, username: string, password: string | null) => Promise<boolean>;
  onStopSync: (forgetWebdav?: boolean) => void;
}) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.sync.backend;
  const copy = text.webdav;

  const [draft, setDraft] = useState<DraftState>({ url: null, username: null, password: "" });
  const [revealed, setRevealed] = useState(false);
  const [testState, setTestState] = useState<TestState>({ phase: "idle" });
  const [confirmAction, setConfirmAction] = useState<"none" | "stop" | "forget">("none");

  useEffect(() => {
    if (confirmAction === "none") return;
    const timer = window.setTimeout(() => setConfirmAction("none"), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [confirmAction]);

  const url = draft.url ?? status.webdav?.url ?? "";
  const username = draft.username ?? status.webdav?.username ?? "";
  const password = draft.password;

  const isWebdavActive = activeSyncBackend(status) === "webdav";
  const canReusePassword = canReuseSavedWebdavPassword(status.webdav, url, username);
  const canSubmit = canSubmitWebdavForm(status.webdav, url, username, password);
  const testing = testState.phase === "testing";

  const updateField = (patch: Partial<DraftState>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setTestState((prev) => (prev.phase === "idle" ? prev : { phase: "idle" }));
  };

  const handleTest = async () => {
    if (!canSubmit || testing || busy) return;
    setTestState({ phase: "testing" });
    try {
      await testSyncWebdav(url, username, password.trim() ? password : null);
      setTestState({ phase: "ok" });
    } catch (error: unknown) {
      setTestState({ phase: "error", error });
    }
  };

  const handleSave = async () => {
    if (!canSubmit || busy || testing) return;
    setTestState({ phase: "idle" });
    const ok = await onSaveWebdav(url, username, password.trim() ? password : null);
    if (ok) {
      setDraft({ url: null, username: null, password: "" });
      setRevealed(false);
    }
  };

  return (
    <>
      <SettingsRow
        title={
          <span className="sync-webdav__label">
            <span>{copy.urlLabel}</span>
            {isWebdavActive ? <span className="sync-badge sync-badge--ok">{copy.activeBadge}</span> : null}
          </span>
        }
        description={copy.urlHint}
        labelFor="sync-webdav-url"
      >
        <div className="sync-webdav__field">
          <SettingsInput
            id="sync-webdav-url"
            type="url"
            monospace
            autoComplete="off"
            value={url}
            placeholder={copy.urlPlaceholder}
            onChange={(event) => updateField({ url: event.currentTarget.value })}
          />
        </div>
      </SettingsRow>

      <SettingsRow
        title={copy.usernameLabel}
        labelFor="sync-webdav-username"
      >
        <div className="sync-webdav__field">
          <SettingsInput
            id="sync-webdav-username"
            type="text"
            autoComplete="off"
            value={username}
            placeholder={copy.usernamePlaceholder}
            onChange={(event) => updateField({ username: event.currentTarget.value })}
          />
        </div>
      </SettingsRow>

      <SettingsRow
        title={copy.passwordLabel}
        description={canReusePassword ? copy.passwordSavedHint : copy.passwordHint}
        labelFor="sync-webdav-password"
      >
        <div className="sync-webdav__field sync-webdav__secret">
          <SettingsInput
            id="sync-webdav-password"
            type={revealed ? "text" : "password"}
            monospace
            autoComplete="off"
            value={password}
            placeholder={canReusePassword ? copy.passwordSavedPlaceholder : copy.passwordPlaceholder}
            onChange={(event) => updateField({ password: event.currentTarget.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit && !busy && !testing) {
                void handleSave();
              }
            }}
          />
          {password ? (
            <button
              type="button"
              className="sync-webdav__eye"
              aria-label={revealed ? t.common.hideSecret : t.common.showSecret}
              onClick={() => setRevealed((current) => !current)}
            >
              {revealed ? (
                <EyeOff size={14} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Eye size={14} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      </SettingsRow>

      <SettingsRow
        searchable={false}
        title=""
        className="sync-webdav__actions-row"
      >
        <div className="sync-webdav__footer">
          <div className="sync-webdav__actions">
            <button
              type="button"
              className="sync-status__button"
              disabled={!canSubmit || busy || testing}
              onClick={() => void handleTest()}
            >
              {testing ? <LoaderCircle size={13} strokeWidth={2} className="sync-status__spinner" aria-hidden="true" /> : null}
              <span>{testing ? copy.testingAction : copy.testAction}</span>
            </button>

            <button
              type="button"
              className="sync-status__button sync-status__button--primary"
              disabled={!canSubmit || busy || testing}
              onClick={() => void handleSave()}
            >
              <span>{isWebdavActive ? copy.updateAction : copy.saveAction}</span>
            </button>

            {isWebdavActive ? (
              confirmAction === "stop" ? (
                <>
                  <SettingsLinkButton onClick={() => setConfirmAction("none")}>{text.stopCancel}</SettingsLinkButton>
                  <SettingsLinkButton
                    tone="danger"
                    disabled={busy}
                    onClick={() => {
                      setConfirmAction("none");
                      onStopSync(false);
                    }}
                  >
                    {text.stopConfirm}
                  </SettingsLinkButton>
                </>
              ) : (
                <SettingsLinkButton tone="danger" disabled={busy} onClick={() => setConfirmAction("stop")}>
                  {text.stopSync}
                </SettingsLinkButton>
              )
            ) : null}

            {status.webdav?.hasPassword ? (
              confirmAction === "forget" ? (
                <>
                  <SettingsLinkButton onClick={() => setConfirmAction("none")}>{text.stopCancel}</SettingsLinkButton>
                  <SettingsLinkButton
                    tone="danger"
                    disabled={busy}
                    onClick={() => {
                      setConfirmAction("none");
                      setDraft({ url: "", username: "", password: "" });
                      onStopSync(true);
                    }}
                  >
                    {copy.forgetConfirm}
                  </SettingsLinkButton>
                </>
              ) : (
                <SettingsLinkButton tone="danger" disabled={busy} onClick={() => setConfirmAction("forget")}>
                  {copy.forgetPassword}
                </SettingsLinkButton>
              )
            ) : null}
          </div>

          {testState.phase === "ok" ? (
            <p className="sync-webdav__feedback sync-webdav__feedback--ok" role="status">
              <CircleCheck size={14} strokeWidth={2} aria-hidden="true" />
              <span>{copy.testOk}</span>
            </p>
          ) : testState.phase === "error" ? (
            <p className="sync-status__error" role="alert">
              {errorText(testState.error)}
            </p>
          ) : null}
        </div>
      </SettingsRow>
    </>
  );
}
