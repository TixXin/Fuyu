import { CheckCheck, ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "../../../i18n";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { ArrivalMediaControls, type ArrivalMedia } from "./ArrivalMediaControls";
import { messagePreviewText } from "../messagePreview";
import { bannerClock } from "../banner/bannerMessages";
import { arrivalKey, type ArrivalMessage } from "./messageArrivals";
import "./MessageArrivalsPanel.css";

export function MessageArrivalsPanel({
  arrivals,
  onOpen,
  onAction,
  onMeasure,
  onShowAll,
  onClearAll,
  media,
}: {
  arrivals: readonly ArrivalMessage[];
  onOpen: (message: ArrivalMessage) => void;
  onAction: (message: ArrivalMessage, action: string) => void;
  onMeasure: (height: number) => void;
  onShowAll: () => void;
  onClearAll: () => void;
  media?: ArrivalMedia;
}) {
  const t = useTranslation().messages;
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => onMeasure(Math.ceil(element.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onMeasure]);

  const inline = arrivals.length === 1 && arrivals[0].inline === true;
  return (
    <section className={`message-arrivals${inline ? " message-arrivals--inline" : ""}`} ref={ref} aria-label={t.arrivals.title}>
      {!inline && (
        <div className="message-arrivals__top">
          <h2 className="message-arrivals__title">{t.arrivals.title}</h2>
          <span className="message-arrivals__tools">
            <button className="message-arrivals__clear" type="button" aria-label={t.arrivals.clearAll} title={t.arrivals.clearAllHint} onClick={onClearAll}>
              <CheckCheck size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
            </button>
            <button className="message-arrivals__all" type="button" onClick={onShowAll}>
              {t.arrivals.showAll}
              <ChevronRight size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
            </button>
          </span>
        </div>
      )}
      <ul className="message-arrivals__list">
        {arrivals.map((message) => {
          const plainWeChat = message.source === "wechat" && !message.chat;
          const title = plainWeChat ? t.wechat : message.title.trim() || (message.source === "qq" ? "QQ" : t.sourceLabels[message.source]);
          const body = plainWeChat ? t.wechatPreview
            : message.source === "qqMail" ? message.body.trim() || t.newMail
              : message.source === "plugin" ? message.body.trim() : message.body.trim() || t.newMessage;
          const controls = message.mediaControls && media ? media : null;
          return (
            <li className={`message-arrivals__item${controls ? " message-arrivals__item--media" : ""}`} key={arrivalKey(message)}>
              <button
                className="message-arrivals__row"
                type="button"
                aria-label={t.openPreview(messagePreviewText(message, t), t.sourceLabels[message.source])}
                onClick={() => onOpen(message)}
              >
                <MessageSourceIcon source={message.source} size={inline ? 32 : 20} account={message.account} iconUrl={message.iconUrl} />
                <span className="message-arrivals__text">
                  <span className="message-arrivals__head">
                    <strong className="message-arrivals__sender">{title}</strong>
                    {!controls && <time className="message-arrivals__time" dateTime={new Date(message.receivedAt).toISOString()}>{bannerClock(message.receivedAt)}</time>}
                  </span>
                  {body && <span className="message-arrivals__body">{body}</span>}
                </span>
              </button>
              {controls && <ArrivalMediaControls media={controls} />}
              {message.actions.length > 0 && (
                <div className="message-arrivals__actions" role="group" aria-label={t.banner.actions}>
                  {message.actions.map((action) => (
                    <button className="message-arrivals__action" type="button" key={action.id} onClick={() => onAction(message, action.id)}>
                      {action.title}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
