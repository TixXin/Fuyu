import { useTranslation } from "../../../i18n";
import type { ReactNode } from "react";
import { ArrowUpRight, Power, Trash2 } from "lucide-react";
import { MessageSourceIcon } from "../MessageSourceIcon";
import "./WeChatReminders.css";
import type { WeChatRemindersController } from "./useWeChatReminders";

export { useWeChatReminders } from "./useWeChatReminders";
export type { WeChatRemindersController };

export function WeChatReminderControls({ controller, compact = false }: { controller: WeChatRemindersController; compact?: boolean }) {
  const { snapshot, busy, actionError, setEnabled } = controller;
  const t = useTranslation();
  return <div className={`qq-panel__controls${compact ? " qq-panel__controls--compact" : ""}`}>
    {compact ? <button className="icon-button message-receiver-toggle" type="button" role="switch" aria-checked={snapshot.enabled} aria-label={t.wechat.receive} disabled={busy} onClick={() => void setEnabled(!snapshot.enabled)}><Power size={15} strokeWidth={1.8} /></button> : <label className="qq-panel__toggle">
      <span>{t.messages.wechatReminders}</span>
      <span className="message-status" data-state={snapshot.status} role="status" aria-label={t.wechat.status[snapshot.status]} />
      <input type="checkbox" role="switch" aria-label={t.wechat.receive} checked={snapshot.enabled} disabled={busy}
        onChange={(event) => void setEnabled(event.currentTarget.checked)} />
    </label>}
    {!compact && (actionError || snapshot.error) && <p className="qq-panel__error" role="alert">{actionError || snapshot.error}</p>}
  </div>;
}

export function WeChatReminderPanel({ controller, navigation }: { controller: WeChatRemindersController; navigation: ReactNode }) {
  const { snapshot, busy, actionError, openWeChat, clear } = controller;
  const t = useTranslation();
  const pending = snapshot.enabled && snapshot.status === "listening" && snapshot.pending;
  const label = snapshot.status === "listening" ? pending ? t.messages.newReminder : t.wechat.noReminders : t.wechat.status[snapshot.status];
  return (
    <section className="qq-panel" aria-label={t.messages.wechatReminders}>
      <header className="qq-panel__header">
        {navigation}
        <div className="qq-panel__toolbar"><WeChatReminderControls controller={controller} compact /><button className="icon-button" type="button" aria-label={t.wechat.open} disabled={busy} onClick={() => void openWeChat()}><ArrowUpRight size={16} strokeWidth={1.8} /></button><button className="icon-button" type="button" aria-label={t.wechat.clear} disabled={busy || snapshot.items.length === 0} onClick={() => void clear()}><Trash2 size={16} strokeWidth={1.8} /></button></div>
      </header>
      {(actionError || snapshot.error) && <p className="qq-panel__error" role="alert">{actionError || snapshot.error}</p>}
      {snapshot.items.length === 0 ? (
        <div className={`qq-panel__empty${pending ? " wechat-reminder-state--pending" : ""}`} role="status">
          <span className="message-empty-icon"><MessageSourceIcon source="wechat" size={28} /></span>
          <span>{label}</span>
        </div>
      ) : (
        // One row per message read from the chat list, as on the QQ page; a reminder that came without one says why.
        <div className="qq-panel__list" role="list" aria-label={t.wechat.list}>
          {snapshot.items.map((item) => {
            const title = item.message?.contact ?? t.messages.newReminder;
            const body = item.message ? item.message.preview : item.reason && t.wechat.plainReason[item.reason];
            return (
              <article className="qq-panel__item" key={item.at} role="listitem" data-message-id={item.at}>
                <button type="button" disabled={busy} onClick={() => void openWeChat(item.message?.chat)} aria-label={t.wechat.openItem(title)}>
                  <div className="qq-panel__item-heading"><strong>{title}</strong><time dateTime={new Date(item.at).toISOString()}>{new Date(item.at).toLocaleTimeString(t.localeTag, { hour: "2-digit", minute: "2-digit" })}</time></div>
                  {body && <p>{body}</p>}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
