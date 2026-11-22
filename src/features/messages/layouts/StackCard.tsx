import { ArrowUpRight, Check } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { FeedConversation } from "../feed/feedModel";
import type { FeedActions } from "../feed/types";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { FeedAvatar } from "./FeedAvatar";
import { FeedOtp } from "./FeedOtp";
import { FeedTime } from "./FeedTime";
import { FeedUnread } from "./FeedUnread";

export function StackCard({ group, open, now, actions, onToggle }: { group: FeedConversation; open: boolean; now: number; actions: FeedActions; onToggle: () => void }) {
  const t = useTranslation();
  const text = t.messages.feed;
  const head = group.items[0];
  const app = t.messages.sourceLabels[group.source];
  const unread = group.items.filter((item) => item.unread > 0);
  const extra = group.items.length - 1;
  const otp = group.items.find((item) => item.otp)?.otp ?? null;
  return (
    <div className={`stack-card${open ? " stack-card--open" : ""}${group.unread > 0 ? "" : " stack-card--read"}`} data-source={group.source} data-depth={Math.min(extra, 2)} role="listitem">
      <div className="stack-card__face">
        <span className="stack-card__bar" aria-hidden="true" />
        <button type="button" className="stack-card__main" aria-expanded={open} onClick={onToggle}>
          <span className="stack-card__top">
            <MessageSourceIcon source={group.source} size={14} account={head.account} />
            <span className="stack-card__app">{app}{head.account ? ` · ${head.account}` : ""}</span>
            <FeedTime at={group.at} now={now} />
          </span>
          <span className="stack-card__who">
            <FeedAvatar item={head} size={24} badge={false} />
            <strong>{group.title}</strong>
            <FeedUnread count={group.unread} dot={group.source === "qqMail"} />
          </span>
          {!open && <span className="stack-card__text">{head.text}</span>}
          {!open && extra > 0 && <span className="stack-card__more">{text.moreInThread(extra)}</span>}
        </button>
        {!open && otp && <span className="stack-card__otp"><FeedOtp code={otp} copy={actions.copy} /></span>}
        {open && (
          <div className="stack-card__thread">
            {[...group.items].reverse().map((item) => <span className="feed-bubble" key={item.key}>{item.text}</span>)}
            {head.plain && <p className="feed-hint">{text.plainHint}</p>}
            {otp && <FeedOtp code={otp} copy={actions.copy} />}
            <div className="stack-card__actions">
              <button type="button" className="feed-button feed-button--solid" onClick={() => actions.open(head)}><ArrowUpRight size={14} strokeWidth={1.8} />{group.source === "qqMail" ? text.open : text.openIn(app)}</button>
              {unread.length > 0 && <button type="button" className="feed-button" onClick={() => actions.read(unread)}><Check size={14} strokeWidth={2} />{text.readGroup}</button>}
              <button type="button" className="feed-button stack-card__collapse" onClick={onToggle}>{text.collapse}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
