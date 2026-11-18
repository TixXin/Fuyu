import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "../../i18n";
import { SettingsLinkButton } from "./SettingsLinkButton";
import "./SettingsInlineConfirm.css";

const CONFIRM_TIMEOUT_MS = 4_000;

export function SettingsInlineConfirm({
  children,
  confirmLabel,
  cancelLabel,
  hint,
  tone = "danger",
  disabled = false,
  onConfirm,
}: {
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  hint?: string;
  tone?: "accent" | "danger";
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const common = useTranslation().common;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timeout = window.setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [confirming]);

  if (!confirming) {
    return (
      <SettingsLinkButton tone={tone} disabled={disabled} onClick={() => setConfirming(true)}>
        {children}
      </SettingsLinkButton>
    );
  }

  return (
    <span className="settings-inline-confirm" role="group" aria-label={hint}>
      <SettingsLinkButton onClick={() => setConfirming(false)}>{cancelLabel ?? common.cancel}</SettingsLinkButton>
      <SettingsLinkButton
        tone="danger"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        {confirmLabel ?? common.confirm}
      </SettingsLinkButton>
    </span>
  );
}

export function SettingsConfirmBar({
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const common = useTranslation().common;

  return (
    <div className="settings-confirm-bar" role="alertdialog" aria-label={message}>
      <span className="settings-confirm-bar__text">{message}</span>
      <span className="settings-confirm-bar__actions">
        <SettingsLinkButton onClick={onCancel}>{cancelLabel ?? common.cancel}</SettingsLinkButton>
        <SettingsLinkButton tone="danger" onClick={onConfirm}>
          {confirmLabel ?? common.confirm}
        </SettingsLinkButton>
      </span>
    </div>
  );
}
