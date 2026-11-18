import { Bot, Copy, Inbox, Pin, Share2, Sparkles, WandSparkles, X, type LucideIcon } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import type { ScreenshotActionIcon } from "./host/actions.mjs";
import type { ScreenshotNoticeState } from "./useScreenshotNotice";
import "./ScreenshotNotice.css";

const ACTION_ICONS: Record<ScreenshotActionIcon, LucideIcon> = {
  inbox: Inbox,
  bot: Bot,
  sparkles: Sparkles,
  share: Share2,
  copy: Copy,
  pin: Pin,
  wand: WandSparkles,
};

export function ScreenshotNotice({ notice }: { notice: ScreenshotNoticeState }) {
  const t = useTranslation().screenshot;
  const { taken, card } = notice;
  if (!taken) return null;
  return (
    <span className="screenshot-notice" role="status" onPointerEnter={card.hold} onPointerLeave={card.release}>
      {taken.thumbnail && (
        <img className="screenshot-notice__thumb" src={taken.thumbnail} alt="" title={t.card.dragHint} draggable={false} onPointerDown={notice.drag} />
      )}
      <span className="screenshot-notice__text">{notice.text}</span>
    </span>
  );
}

export function ScreenshotNoticeActions({ notice }: { notice: ScreenshotNoticeState }) {
  const t = useTranslation().screenshot;
  const { locale } = useLocale();
  const { card } = notice;
  if (!notice.taken) return null;
  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };
  return (
    <span className="screenshot-notice__actions" onPointerEnter={card.hold} onPointerLeave={card.release}>
      <button className="screenshot-notice__action" type="button" aria-label={t.card.shelf} title={t.card.shelf} onClick={stop(notice.shelve)}>
        <Inbox size={13} strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        className="screenshot-notice__action"
        type="button"
        aria-label={t.card.sendToAgent}
        title={notice.canSend ? t.card.sendToAgent : t.card.noAgent}
        disabled={!notice.canSend}
        onClick={stop(() => void notice.sendToAgent())}
      >
        <Bot size={13} strokeWidth={2} aria-hidden="true" />
      </button>
      {notice.extraActions.map((action) => {
        const Icon = ACTION_ICONS[action.icon] ?? Sparkles;
        const label = action.label[locale];
        const title = action.disabled && action.disabledTitle ? action.disabledTitle[locale] : label;
        return (
          <button
            key={action.id}
            className="screenshot-notice__action"
            type="button"
            aria-label={label}
            title={title}
            disabled={action.disabled}
            onClick={stop(() => notice.runAction(action.id))}
          >
            <Icon size={13} strokeWidth={2} aria-hidden="true" />
          </button>
        );
      })}
      <button className="screenshot-notice__action" type="button" aria-label={t.card.close} title={t.card.close} onClick={stop(card.dismiss)}>
        <X size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}
