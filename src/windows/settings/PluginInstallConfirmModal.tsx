import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Blocks, X } from "lucide-react";
import type { MarketLocalizedText, PluginInstallConfirmation } from "@fuyu/plugin-services";
import { useLocale, useTranslation } from "../../i18n";
import "./PluginsV3SettingsPage.css";
import "./PluginMarketV3Tab.css";

export interface PendingPluginInstall {
  id: string;
  version: string;
  isUpdate?: boolean;
  fresh?: boolean;
  confirmation: PluginInstallConfirmation;
}

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])";

export function resolvePluginText(value: MarketLocalizedText | string | undefined, locale: string, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === "string") return value || fallback;
  return (locale === "en" ? value.en : value["zh-CN"]) || value["zh-CN"] || value.en || fallback;
}

function CapabilityRow({ label, items, emptyText }: { label: string; items: readonly string[]; emptyText: string }) {
  return (
    <div className="plugins-v3__cap-row">
      <dt>{label}</dt>
      <dd>
        {items.length > 0 ? items.join(", ") : <span className="plugins-v3__cap-empty">{emptyText}</span>}
      </dd>
    </div>
  );
}

export function PluginInstallConfirmModal({
  pending,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  pending: PendingPluginInstall;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { locale } = useLocale();
  const text = useTranslation().settings.pluginsV3;
  const copy = text.market.confirmModal;
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => before?.focus();
  }, []);

  const { id, version, isUpdate, fresh, confirmation } = pending;
  const displayName = resolvePluginText(confirmation.displayName, locale, id);
  const description = resolvePluginText(confirmation.description, locale, "");
  const title = isUpdate ? copy.titleUpdate : copy.titleInstall;

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (!busy) {
        event.stopPropagation();
        onCancel();
      }
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="plugins-v3__modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="plugins-v3__modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-install-modal={id}
        onKeyDown={onKeyDown}
      >
        <div className="plugins-v3__modal-head">
          <span className="plugins-v3__icon plugins-v3__icon--lg plugins-v3__icon--info" aria-hidden="true">
            <Blocks size={18} strokeWidth={2} />
            <span className="plugins-v3__dot" />
          </span>
          <div className="plugins-v3__title-col">
            <div className="plugins-v3__title-line">
              <strong className="plugins-v3__modal-title">{displayName}</strong>
              <span className="plugins-v3__pill">{`v${version}`}</span>
              {confirmation.official ? (
                <span className="plugins-v3__pill plugins-v3__pill--official">{copy.sourceOfficial}</span>
              ) : !confirmation.unreviewed ? (
                <span className="plugins-v3__pill plugins-v3__pill--mint">{copy.sourceMarket}</span>
              ) : null}
            </div>
            <span className="plugins-v3__id">{id}</span>
          </div>
          <button
            ref={cancelRef}
            className="plugins-v3__modal-close"
            type="button"
            disabled={busy}
            aria-label={text.closeDetail}
            title={text.closeDetail}
            onClick={onCancel}
          >
            <X size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        {confirmation.unreviewed ? <p className="plugins-v3__warn-banner">{copy.sourceManualWarn}</p> : null}
        {confirmation.trustChange ? (
          <p className="plugins-v3__warn-banner" data-trust-change={confirmation.trustChange}>
            {copy.trustChangeWarn}
          </p>
        ) : null}
        {description ? <p className="plugins-v3__note">{description}</p> : null}
        {fresh ? (
          <p className="plugins-v3__detail" data-cooldown-note="">
            {isUpdate ? copy.cooldownUpdateNote : copy.cooldownInstallNote}
          </p>
        ) : null}
        {confirmation.requiredPlugins && confirmation.requiredPlugins.length > 0 ? (
          <p className="plugins-v3__detail plugins-v3__detail--info" data-required-plugins={confirmation.requiredPlugins.join(",")}>
            {copy.requiresNote(confirmation.requiredPlugins.join(", "))}
          </p>
        ) : null}

        {confirmation.network.length + confirmation.nodeApis.length + confirmation.provides.length + confirmation.replaces.length + confirmation.slots.length > 0 ? (
          <dl className="plugins-v3__caps">
            {confirmation.network.length > 0 ? <CapabilityRow label={copy.networkLabel} items={confirmation.network} emptyText={copy.networkNone} /> : null}
            {confirmation.nodeApis.length > 0 ? <CapabilityRow label={copy.nodeApisLabel} items={confirmation.nodeApis} emptyText={copy.nodeApisNone} /> : null}
            {confirmation.provides.length > 0 ? <CapabilityRow label={copy.providesLabel} items={confirmation.provides} emptyText={copy.capabilityNone} /> : null}
            {confirmation.replaces.length > 0 ? <CapabilityRow label={copy.replacesLabel} items={confirmation.replaces} emptyText={copy.capabilityNone} /> : null}
            {confirmation.slots.length > 0 ? <CapabilityRow label={copy.slotsLabel} items={confirmation.slots} emptyText={copy.capabilityNone} /> : null}
          </dl>
        ) : null}

        <p className="plugins-v3__security-note">{copy.hostSecurityNote}</p>
        {error ? <p className="plugins-v3__error-banner">{error}</p> : null}

        <div className="plugins-v3__modal-actions">
          <button className="plugins-v3__btn" type="button" disabled={busy} onClick={onCancel}>
            {copy.cancelBtn}
          </button>
          <button
            className="plugins-v3__btn plugins-v3__btn--primary"
            type="button"
            disabled={busy}
            data-action="confirm-install"
            onClick={onConfirm}
          >
            {busy ? text.market.installingBtn : copy.confirmBtn}
          </button>
        </div>
      </div>
    </div>,
    document.querySelector(".settings-stage") ?? document.getElementById("page") ?? document.body,
  );
}
