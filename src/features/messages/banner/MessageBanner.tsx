import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type Ref } from "react";
import { X } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { copyMessageText } from "../../../lib/api";
import { notificationCopyableText } from "../messageCopy";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { messagePreviewText } from "../messagePreview";
import { bannerClock, bannerKey, type BannerState } from "./bannerMessages";
import "./MessageBanner.css";

export function MessageBanner({
  banner,
  bannerRef,
  onOpen,
  onClose,
  onAction,
}: {
  banner: BannerState;
  bannerRef?: Ref<HTMLDivElement>;
  onOpen: () => void;
  onClose: () => void;
  onAction: (id: string) => void;
}) {
  const t = useTranslation().messages;
  const { message, more } = banner;
  const currentKey = bannerKey(message);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  const fallbackTitle = message.source === "qq" ? "QQ" : t.sourceLabels[message.source];
  const title = message.title.trim() || fallbackTitle;
  const plainWeChat = message.source === "wechat" && !message.chat;
  const body = message.source === "plugin" ? message.body.trim()
    : message.source === "qqMail" ? message.body.trim() || t.newMail
      : message.body.trim() || t.newMessage;
  const copyable = plainWeChat ? "" : notificationCopyableText(message.title, message.body);
  const copied = copiedKey === currentKey;

  const handleContextMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || !copyable) return;
    event.preventDefault();
    void copyMessageText(copyable).then(() => {
      setCopiedKey(currentKey);
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedKey((current) => (current === currentKey ? null : current)), 1200);
    }).catch(() => undefined);
  };

  return (
    <div className={`message-banner message-banner--${message.source}`} ref={bannerRef} role="status" aria-live="polite">
      <button
        className="message-banner__main"
        type="button"
        aria-label={t.openPreview(messagePreviewText(message, t), t.sourceLabels[message.source])}
        onClick={onOpen}
        onContextMenu={handleContextMenu}
      >
        <MessageSourceIcon source={message.source} size={20} account={message.account} iconUrl={message.iconUrl} />
        <span className="message-banner__text">
          <span className="message-banner__head">
            <strong className="message-banner__title">{title}</strong>
            {copied
              ? <span className="message-banner__copied">{t.copied}</span>
              : <time className="message-banner__time" dateTime={new Date(message.receivedAt).toISOString()}>{bannerClock(message.receivedAt)}</time>}
          </span>
          {body && <span className="message-banner__body">{body}</span>}
          {more > 0 && <span className="message-banner__more">{t.banner.more(more)}</span>}
        </span>
      </button>
      <button className="message-banner__close" type="button" aria-label={t.banner.close} onClick={onClose}>
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      {message.actions.length > 0 && (
        <div className="message-banner__actions" role="group" aria-label={t.banner.actions}>
          {message.actions.map((action) => (
            <button className="message-banner__action" type="button" key={action.id} onClick={() => onAction(action.id)}>
              {action.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
