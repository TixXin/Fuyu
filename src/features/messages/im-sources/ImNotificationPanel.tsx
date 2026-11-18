import { ArrowUpRight, Check, Copy, KeyRound, Power, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation, type Translations } from "../../../i18n";
import { copyMessageText } from "../../../lib/api";
import { isMacOS } from "../../../lib/platform";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { notificationCopyableText } from "../messageCopy";
import "../qq-notifications/QQNotifications.css";
import type { ImNotificationKind, ImSourceId, ImSourceStatus } from "./imSourcesState";

export type ImPanelSource = "qq" | ImSourceId;

export type ImPanelItem = {
  id: string;
  kind?: ImNotificationKind;
  title: string;
  body: string;
  createdAt: number;
  unread?: number | null;
};

export type ImPanelControlsModel = {
  snapshot: {
    enabled: boolean;
    status: ImSourceStatus;
    error: string | null;
  };
  busy: boolean;
  actionError: string | null;
  setEnabled: (enabled: boolean) => unknown;
  requestAccess: () => unknown;
  openSettings: () => unknown;
};

export type ImPanelController = ImPanelControlsModel & {
  snapshot: ImPanelControlsModel["snapshot"] & {
    items: readonly ImPanelItem[];
  };
  refresh: () => unknown;
  clear: () => unknown;
  openApp: () => unknown;
};

export type ImPanelCopy = {
  title: string;
  receive: string;
  recent: string;
  list: string;
  open: string;
  refresh: string;
  clear: string;
  allowLabel: string;
  grant: string;
  settings: string;
  settingsMac: string;
  retryLabel: string;
  permissionRequiredMac: string;
  openNotification: (title: string) => string;
  status: Record<ImSourceStatus, string>;
  flashBody: string;
};

export function imPanelCopyFor(source: ImPanelSource, t: Translations): ImPanelCopy {
  if (source === "qq") {
    return {
      title: t.qq.title,
      receive: t.qq.receive,
      recent: t.qq.recent,
      list: t.qq.list,
      open: t.qq.open,
      refresh: t.qq.refresh,
      clear: t.qq.clear,
      allowLabel: t.qq.allowLabel,
      grant: t.qq.grant,
      settings: t.qq.settings,
      settingsMac: t.qq.settingsMac,
      retryLabel: t.qq.retryLabel,
      permissionRequiredMac: t.qq.permissionRequiredMac,
      openNotification: t.qq.openNotification,
      status: t.qq.status,
      flashBody: t.messages.im.flashBody,
    };
  }
  const name = t.messages.sourceLabels[source];
  const im = t.messages.im;
  return {
    title: im.title(name),
    receive: im.receive(name),
    recent: im.recent(name),
    list: im.list(name),
    open: im.open(name),
    refresh: im.refresh(name),
    clear: im.clear(name),
    allowLabel: im.allowLabel(name),
    grant: t.qq.grant,
    settings: t.qq.settings,
    settingsMac: t.qq.settingsMac,
    retryLabel: im.retryLabel(name),
    permissionRequiredMac: t.qq.permissionRequiredMac,
    openNotification: (title) => im.openNotification(name, title),
    status: t.qq.status,
    flashBody: im.flashBody,
  };
}

export function ImNotificationControls({
  controller,
  copy,
  compact = false,
}: {
  controller: ImPanelControlsModel;
  copy: ImPanelCopy;
  compact?: boolean;
}) {
  const { snapshot, busy, actionError, setEnabled, requestAccess, openSettings } = controller;
  const needsAccess = snapshot.status === "permissionRequired" || snapshot.status === "permissionDenied";
  return (
    <div className={`qq-panel__controls${compact ? " qq-panel__controls--compact" : ""}`}>
      <div className="qq-panel__control-row">
        {compact ? (
          <button
            className="icon-button message-receiver-toggle"
            type="button"
            role="switch"
            aria-checked={snapshot.enabled}
            aria-label={copy.receive}
            disabled={busy}
            onClick={() => void setEnabled(!snapshot.enabled)}
          >
            <Power size={15} strokeWidth={1.8} />
          </button>
        ) : (
          <label className="qq-panel__toggle">
            <span>{copy.title}</span>
            <span className="message-status" data-state={snapshot.status} role="status" aria-label={copy.status[snapshot.status]} />
            <input
              type="checkbox"
              role="switch"
              aria-label={copy.receive}
              checked={snapshot.enabled}
              disabled={busy}
              onChange={(event) => void setEnabled(event.currentTarget.checked)}
            />
          </label>
        )}
        {snapshot.enabled && (needsAccess || snapshot.status === "error" || snapshot.error || actionError) && (
          <div className="qq-panel__actions">
            {snapshot.status === "permissionRequired" && (
              <button className="message-action" type="button" aria-label={copy.allowLabel} disabled={busy} onClick={() => void requestAccess()}>
                <KeyRound size={14} strokeWidth={1.8} />
                {copy.grant}
              </button>
            )}
            {(snapshot.status === "permissionDenied" || snapshot.error || actionError) && (
              <button className="icon-button" type="button" aria-label={isMacOS ? copy.settingsMac : copy.settings} disabled={busy} onClick={() => void openSettings()}>
                <Settings2 size={16} strokeWidth={1.8} />
              </button>
            )}
            {snapshot.status === "error" && (
              <button className="icon-button" type="button" aria-label={copy.retryLabel} disabled={busy} onClick={() => void requestAccess()}>
                <KeyRound size={16} strokeWidth={1.8} />
              </button>
            )}
          </div>
        )}
      </div>
      {!compact && needsAccess && <p className="qq-panel__error" role="alert">{copy.status[snapshot.status]}</p>}
      {!compact && (actionError || snapshot.error) && <p className="qq-panel__error" role="alert">{actionError || snapshot.error}</p>}
    </div>
  );
}

export function ImNotificationPanel({
  source,
  controller,
  copy,
  navigation,
}: {
  source: ImPanelSource;
  controller: ImPanelController;
  copy?: ImPanelCopy;
  navigation: ReactNode;
}) {
  const { snapshot, busy, actionError, refresh, clear, openApp } = controller;
  const t = useTranslation();
  const labels = copy ?? imPanelCopyFor(source, t);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  const error = actionError
    || snapshot.error
    || (snapshot.status === "permissionRequired" || snapshot.status === "permissionDenied"
      ? (isMacOS ? labels.permissionRequiredMac : labels.status[snapshot.status])
      : null);

  return (
    <section className="qq-panel" aria-label={labels.recent}>
      <header className="qq-panel__header">
        {navigation}
        <div className="qq-panel__toolbar">
          <ImNotificationControls controller={controller} copy={labels} compact />
          <button className="icon-button" type="button" aria-label={labels.open} disabled={busy} onClick={() => void openApp()}>
            <ArrowUpRight size={16} strokeWidth={1.8} />
          </button>
          <button className="icon-button" type="button" aria-label={labels.refresh} disabled={busy} onClick={() => void refresh()}>
            <RefreshCw size={16} strokeWidth={1.8} />
          </button>
          <button className="icon-button" type="button" aria-label={labels.clear} disabled={busy || snapshot.items.length === 0} onClick={() => void clear()}>
            <Trash2 size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>
      {error && <p className="qq-panel__error" role="alert">{error}</p>}
      <div className="qq-panel__list" role="list" aria-label={labels.list} aria-busy={busy}>
        {snapshot.items.length === 0 ? (
          <div className="qq-panel__empty" role="status">
            <span className="message-empty-icon"><MessageSourceIcon source={source} size={28} /></span>
            <span>{t.common.noMessages}</span>
          </div>
        ) : snapshot.items.map((item) => {
          const isFlash = item.kind === "flash";
          const isBadge = item.kind === "badge" || Boolean(item.unread);
          const heading = isFlash
            ? t.messages.newReminder
            : isBadge
              ? (source === "qq" ? item.title : t.messages.sourceLabels[source])
              : (item.title || (source === "qq" ? "QQ" : t.messages.sourceLabels[source]));
          const body = isFlash
            ? labels.flashBody
            : isBadge
              ? t.messages.unreadCount(item.unread ?? 1)
              : item.body;
          const copyable = isFlash || isBadge ? "" : notificationCopyableText(item.title, item.body);
          const copied = copiedId === item.id;
          return (
            <article className={`qq-panel__item${copyable ? " qq-panel__item--copyable" : ""}`} key={item.id} role="listitem" data-message-id={item.id}>
              <button type="button" disabled={busy} onClick={() => void openApp()} aria-label={labels.openNotification(heading)}>
                <div className="qq-panel__item-heading">
                  <strong>{heading}</strong>
                  <time dateTime={new Date(item.createdAt).toISOString()}>
                    {new Date(item.createdAt).toLocaleTimeString(t.localeTag, { hour: "2-digit", minute: "2-digit" })}
                  </time>
                </div>
                {body && <p>{body}</p>}
              </button>
              {copyable && (
                <button
                  className={`icon-button qq-panel__copy${copied ? " qq-panel__copy--done" : ""}`}
                  type="button"
                  aria-label={copied ? t.messages.copied : t.messages.copyText}
                  onClick={() => {
                    void copyMessageText(copyable).then(() => {
                      setCopiedId(item.id);
                      window.clearTimeout(copyTimerRef.current);
                      copyTimerRef.current = window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1400);
                    }).catch(() => undefined);
                  }}
                >
                  {copied ? <Check size={14} strokeWidth={1.9} aria-hidden="true" /> : <Copy size={14} strokeWidth={1.8} aria-hidden="true" />}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
