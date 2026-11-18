import { useState } from "react";
import { AlertTriangle, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import type { SyncEncryptionText } from "../../i18n/sections/syncEncryption";

export const MIN_PASSPHRASE_LEN = 6;

export type EncryptionPanelKind = "none" | "enable" | "change" | "disable" | "reset";

export function SecretField({
  id,
  value,
  placeholder,
  disabled,
  showLabel,
  hideLabel,
  onChange,
  onSubmit,
}: {
  id: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  showLabel: string;
  hideLabel: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="sync-webdav__field sync-webdav__secret">
      <SettingsInput
        id={id}
        type={shown ? "text" : "password"}
        monospace
        autoComplete="off"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onSubmit) onSubmit();
        }}
      />
      {value ? (
        <button
          type="button"
          className="sync-webdav__eye"
          aria-label={shown ? hideLabel : showLabel}
          onClick={() => setShown((prev) => !prev)}
        >
          {shown ? <EyeOff size={14} strokeWidth={2} aria-hidden="true" /> : <Eye size={14} strokeWidth={2} aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  );
}

export function SyncEncryptionEnablePanel({
  copy,
  showSecretLabel,
  hideSecretLabel,
  activeBackend,
  busy,
  working,
  onCancel,
  onSubmit,
}: {
  copy: SyncEncryptionText;
  showSecretLabel: string;
  hideSecretLabel: string;
  activeBackend: boolean;
  busy: boolean;
  working: boolean;
  onCancel: () => void;
  onSubmit: (passphrase: string) => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const trimmed = passphrase.trim();
  const confirmTrimmed = confirmPassphrase.trim();
  const mismatch = trimmed.length > 0 && confirmTrimmed.length > 0 && trimmed !== confirmTrimmed;
  const canSubmit = activeBackend && trimmed.length >= MIN_PASSPHRASE_LEN && trimmed === confirmTrimmed && !busy;

  return (
    <div className="sync-encryption__panel">
      <div className="sync-encryption__warning" role="note">
        <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
        <div className="sync-encryption__warning-copy">
          <strong>{copy.warningTitle}</strong>
          <p>{copy.warningBody}</p>
        </div>
      </div>

      <div className="sync-encryption__fields">
        <label className="sync-encryption__label" htmlFor="sync-enc-passphrase">
          <span>{copy.passphraseLabel}</span>
          <SecretField
            id="sync-enc-passphrase"
            value={passphrase}
            placeholder={copy.passphrasePlaceholder}
            disabled={busy}
            showLabel={showSecretLabel}
            hideLabel={hideSecretLabel}
            onChange={setPassphrase}
          />
        </label>

        <label className="sync-encryption__label" htmlFor="sync-enc-confirm">
          <span>{copy.confirmPassphraseLabel}</span>
          <SecretField
            id="sync-enc-confirm"
            value={confirmPassphrase}
            placeholder={copy.confirmPassphrasePlaceholder}
            disabled={busy}
            showLabel={showSecretLabel}
            hideLabel={hideSecretLabel}
            onChange={setConfirmPassphrase}
            onSubmit={() => {
              if (canSubmit) onSubmit(trimmed);
            }}
          />
        </label>
      </div>

      {mismatch ? <p className="sync-status__error" role="alert">{copy.passphraseMismatch}</p> : null}

      <div className="sync-encryption__actions">
        <SettingsLinkButton disabled={busy} onClick={onCancel}>
          {copy.cancelAction}
        </SettingsLinkButton>
        <button
          type="button"
          className="sync-status__button sync-status__button--primary"
          disabled={!canSubmit}
          onClick={() => onSubmit(trimmed)}
        >
          {working ? <LoaderCircle size={13} strokeWidth={2} className="sync-status__spinner" aria-hidden="true" /> : null}
          <span>{working ? copy.enablingAction : copy.enableSubmitAction}</span>
        </button>
      </div>
    </div>
  );
}

export function SyncEncryptionChangePanel({
  copy,
  showSecretLabel,
  hideSecretLabel,
  activeBackend,
  busy,
  working,
  onCancel,
  onSubmit,
}: {
  copy: SyncEncryptionText;
  showSecretLabel: string;
  hideSecretLabel: string;
  activeBackend: boolean;
  busy: boolean;
  working: boolean;
  onCancel: () => void;
  onSubmit: (currentSecret: string, newPassphrase: string) => void;
}) {
  const [currentSecret, setCurrentSecret] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const currentTrimmed = currentSecret.trim();
  const nextTrimmed = newPassphrase.trim();
  const confirmTrimmed = confirmPassphrase.trim();
  const mismatch = nextTrimmed.length > 0 && confirmTrimmed.length > 0 && nextTrimmed !== confirmTrimmed;
  const canSubmit =
    activeBackend && currentTrimmed.length > 0 && nextTrimmed.length >= MIN_PASSPHRASE_LEN && nextTrimmed === confirmTrimmed && !busy;

  return (
    <div className="sync-encryption__panel">
      <p className="sync-encryption__note">{copy.changePassphraseHint}</p>
      <div className="sync-encryption__fields">
        <label className="sync-encryption__label" htmlFor="sync-enc-current">
          <span>{copy.currentSecretLabel}</span>
          <SecretField
            id="sync-enc-current"
            value={currentSecret}
            placeholder={copy.currentSecretPlaceholder}
            disabled={busy}
            showLabel={showSecretLabel}
            hideLabel={hideSecretLabel}
            onChange={setCurrentSecret}
          />
        </label>
        <label className="sync-encryption__label" htmlFor="sync-enc-new">
          <span>{copy.newPassphraseLabel}</span>
          <SecretField
            id="sync-enc-new"
            value={newPassphrase}
            placeholder={copy.newPassphrasePlaceholder}
            disabled={busy}
            showLabel={showSecretLabel}
            hideLabel={hideSecretLabel}
            onChange={setNewPassphrase}
          />
        </label>
        <label className="sync-encryption__label" htmlFor="sync-enc-new-confirm">
          <span>{copy.confirmPassphraseLabel}</span>
          <SecretField
            id="sync-enc-new-confirm"
            value={confirmPassphrase}
            placeholder={copy.confirmPassphrasePlaceholder}
            disabled={busy}
            showLabel={showSecretLabel}
            hideLabel={hideSecretLabel}
            onChange={setConfirmPassphrase}
            onSubmit={() => {
              if (canSubmit) onSubmit(currentTrimmed, nextTrimmed);
            }}
          />
        </label>
      </div>
      {mismatch ? <p className="sync-status__error" role="alert">{copy.passphraseMismatch}</p> : null}
      <div className="sync-encryption__actions">
        <SettingsLinkButton disabled={busy} onClick={onCancel}>
          {copy.cancelAction}
        </SettingsLinkButton>
        <button
          type="button"
          className="sync-status__button sync-status__button--primary"
          disabled={!canSubmit}
          onClick={() => onSubmit(currentTrimmed, nextTrimmed)}
        >
          {working ? <LoaderCircle size={13} strokeWidth={2} className="sync-status__spinner" aria-hidden="true" /> : null}
          <span>{working ? copy.changingPassphraseAction : copy.changePassphraseSubmit}</span>
        </button>
      </div>
    </div>
  );
}

export function SyncEncryptionDisablePanel({
  copy,
  showSecretLabel,
  hideSecretLabel,
  activeBackend,
  busy,
  working,
  onCancel,
  onSubmit,
}: {
  copy: SyncEncryptionText;
  showSecretLabel: string;
  hideSecretLabel: string;
  activeBackend: boolean;
  busy: boolean;
  working: boolean;
  onCancel: () => void;
  onSubmit: (secret: string) => void;
}) {
  const [secret, setSecret] = useState("");
  const trimmed = secret.trim();
  const canSubmit = activeBackend && trimmed.length > 0 && !busy;

  return (
    <div className="sync-encryption__panel">
      <p className="sync-encryption__note">{copy.disableWarning}</p>
      <label className="sync-encryption__label" htmlFor="sync-enc-disable-secret">
        <span>{copy.currentSecretLabel}</span>
        <SecretField
          id="sync-enc-disable-secret"
          value={secret}
          placeholder={copy.currentSecretPlaceholder}
          disabled={busy}
          showLabel={showSecretLabel}
          hideLabel={hideSecretLabel}
          onChange={setSecret}
          onSubmit={() => {
            if (canSubmit) onSubmit(trimmed);
          }}
        />
      </label>
      <div className="sync-encryption__actions">
        <SettingsLinkButton disabled={busy} onClick={onCancel}>
          {copy.cancelAction}
        </SettingsLinkButton>
        <button
          type="button"
          className="sync-status__button sync-status__button--primary"
          disabled={!canSubmit}
          onClick={() => onSubmit(trimmed)}
        >
          {working ? <LoaderCircle size={13} strokeWidth={2} className="sync-status__spinner" aria-hidden="true" /> : null}
          <span>{working ? copy.disablingAction : copy.disableSubmit}</span>
        </button>
      </div>
    </div>
  );
}

export function SyncEncryptionResetPanel({
  copy,
  showSecretLabel,
  hideSecretLabel,
  activeBackend,
  busy,
  working,
  onCancel,
  onSubmit,
}: {
  copy: SyncEncryptionText;
  showSecretLabel: string;
  hideSecretLabel: string;
  activeBackend: boolean;
  busy: boolean;
  working: boolean;
  onCancel: () => void;
  onSubmit: (passphrase: string | null) => void;
}) {
  const [resetPassphrase, setResetPassphrase] = useState("");
  const trimmed = resetPassphrase.trim();
  const canSubmit = activeBackend && (trimmed.length === 0 || trimmed.length >= MIN_PASSPHRASE_LEN) && !busy;

  return (
    <div className="sync-encryption__panel">
      <div className="sync-encryption__warning" role="note">
        <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
        <div className="sync-encryption__warning-copy">
          <strong>{copy.resetWarningTitle}</strong>
          <p>{copy.resetWarningBody}</p>
        </div>
      </div>
      <label className="sync-encryption__label" htmlFor="sync-enc-reset-pass">
        <span>{copy.resetPassphraseLabel}</span>
        <SecretField
          id="sync-enc-reset-pass"
          value={resetPassphrase}
          placeholder={copy.resetPassphrasePlaceholder}
          disabled={busy}
          showLabel={showSecretLabel}
          hideLabel={hideSecretLabel}
          onChange={setResetPassphrase}
          onSubmit={() => {
            if (canSubmit) onSubmit(trimmed.length > 0 ? trimmed : null);
          }}
        />
      </label>
      <div className="sync-encryption__actions">
        <SettingsLinkButton disabled={busy} onClick={onCancel}>
          {copy.cancelAction}
        </SettingsLinkButton>
        <button
          type="button"
          className="sync-status__button sync-status__button--primary"
          disabled={!canSubmit}
          onClick={() => onSubmit(trimmed.length > 0 ? trimmed : null)}
        >
          {working ? <LoaderCircle size={13} strokeWidth={2} className="sync-status__spinner" aria-hidden="true" /> : null}
          <span>{working ? copy.resettingAction : copy.resetSubmit}</span>
        </button>
      </div>
    </div>
  );
}
