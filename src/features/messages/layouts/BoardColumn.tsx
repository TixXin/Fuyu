import { ArrowUpRight, BellOff, CheckCheck, KeyRound, Settings2, Trash2 } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { FeedItem } from "../feed/feedModel";
import type { FeedActions, FeedSourceState } from "../feed/types";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { FeedOtp } from "./FeedOtp";
import { FeedStatus } from "./FeedStatusLine";
import { FeedTime } from "./FeedTime";
import { FeedUnread } from "./FeedUnread";

export function BoardColumn({ source, items, now, actions, onDetails }: { source: FeedSourceState; items: readonly FeedItem[]; now: number; actions: FeedActions; onDetails: () => void }) {
  const t = useTranslation();
  const text = t.messages.feed;
  const blocked = source.status === "off" || source.status === "access" || source.status === "auth" || source.status === "setup";
  const isMail = source.id === "qqMail";
  const state = blocked ? (
    <div className="board-column__state">
      {source.status === "off" ? <BellOff size={22} strokeWidth={1.6} aria-hidden="true" /> : <KeyRound size={22} strokeWidth={1.6} aria-hidden="true" />}
      <span>{text.notice[source.status as "off" | "access" | "auth" | "setup"](source.label)}</span>
      {!(source.status === "access" && source.id === "wechat") && (
        <button type="button" className="feed-button feed-button--solid" disabled={source.busy} onClick={() => (source.status === "off" ? actions.enable(source.id) : actions.fix(source.id))}>
          {source.status === "off" ? text.turnOn : source.status === "access" ? text.grant : text.fixInSettings}
        </button>
      )}
    </div>
  ) : items.length === 0 ? (
    <div className="board-column__state">
      <MessageSourceIcon source={source.id} size={28} />
      <span>{text.doneSource(source.label)}</span>
      <FeedStatus source={source} />
    </div>
  ) : null;
  return (
    <section className="board-column" data-source={source.id} aria-label={source.label}>
      <header className="board-column__head">
        <MessageSourceIcon source={source.id} size={18} />
        <strong>{source.label}</strong>
        {source.unread > 0 ? <span className="board-column__count">{text.unread(source.unread)}</span> : <FeedStatus source={source} />}
        <button type="button" className="feed-icon-button board-column__details" aria-label={text.sourceDetails(source.label)} onClick={onDetails}><Settings2 size={14} strokeWidth={1.8} /></button>
      </header>
      <div className="board-column__list feed-scroll" role="list">
        {state ?? items.map((item) => (
          <div className={`board-card${item.unread > 0 ? "" : " board-card--read"}`} role="listitem" key={item.key}>
            <button type="button" className="board-card__main" onClick={() => actions.open(item)} aria-label={`${text.open}：${item.title}`}>
              <span className="board-card__l1"><strong>{item.title}</strong><FeedUnread count={item.unread} dot={isMail} /><FeedTime at={item.at} now={now} /></span>
              <span className="board-card__text">{item.text}</span>
            </button>
            {item.otp && <span className="board-card__otp"><FeedOtp code={item.otp} copy={actions.copy} /></span>}
          </div>
        ))}
      </div>
      <footer className="board-column__foot">
        <button type="button" className="feed-button" onClick={() => actions.openApp(source.id)}><ArrowUpRight size={14} strokeWidth={1.8} />{text.openApp(source.label)}</button>
        <span className="board-column__spacer" />
        {items.some((item) => item.unread > 0) && <button type="button" className="feed-icon-button" aria-label={text.readAll} onClick={() => actions.readAll(source.id)}><CheckCheck size={14} strokeWidth={1.8} /></button>}
        {!isMail && items.length > 0 && <button type="button" className="feed-icon-button" aria-label={text.clear(source.label)} onClick={() => actions.clear(source.id)}><Trash2 size={14} strokeWidth={1.8} /></button>}
      </footer>
    </section>
  );
}
