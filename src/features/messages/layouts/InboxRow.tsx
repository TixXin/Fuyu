import { ArrowUpRight, Check, Copy } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { FeedRun } from "../feed/feedModel";
import type { FeedActions } from "../feed/types";
import { FeedAvatar } from "./FeedAvatar";
import { FeedOtp, useCopied } from "./FeedOtp";
import { FeedTime } from "./FeedTime";
import { FeedUnread } from "./FeedUnread";

export function InboxRow({ run, now, open, onToggle, actions }: { run: FeedRun; now: number; open: boolean; onToggle: () => void; actions: FeedActions }) {
  const t = useTranslation();
  const text = t.messages.feed;
  const { item, lines } = run;
  const unread = lines.reduce((sum, line) => sum + line.unread, 0);
  const app = t.messages.sourceLabels[item.source];
  const { copied, run: copy } = useCopied(actions.copy);
  const fullText = lines.map((line) => line.text).reverse().join("\n");
  return (
    <div className={`inbox-row${unread > 0 ? "" : " inbox-row--read"}${open ? " inbox-row--open" : ""}`} role="listitem" data-source={item.source}>
      <button type="button" className="inbox-row__main" aria-expanded={open} onClick={onToggle}>
        <FeedAvatar item={item} />
        <span className="inbox-row__body">
          <span className="inbox-row__l1">
            <strong>{item.title}</strong>
            {item.account && <span className="inbox-row__meta">{item.account}</span>}
            <FeedTime at={item.at} now={now} />
          </span>
          {!open && (
            <span className="inbox-row__l2">
              <span className="inbox-row__text">{item.text}</span>
              {lines.length > 1 && <span className="inbox-row__more">{text.moreInThread(lines.length - 1)}</span>}
              <FeedUnread count={unread} dot={item.source === "qqMail"} />
            </span>
          )}
        </span>
      </button>
      {item.otp && !open && <FeedOtp code={item.otp} copy={actions.copy} />}
      {!open && (
        <span className="inbox-row__hover">
          {unread > 0 && <button type="button" className="feed-icon-button" aria-label={text.read} onClick={() => actions.read(lines)}><Check size={15} strokeWidth={2} /></button>}
          <button type="button" className="feed-icon-button" aria-label={copied === item.key ? text.copied : text.copy} onClick={() => copy(item.key, fullText)}>{copied === item.key ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.8} />}</button>
          <button type="button" className="feed-icon-button" aria-label={item.source === "qqMail" ? text.open : text.openIn(app)} onClick={() => actions.open(item)}><ArrowUpRight size={15} strokeWidth={1.8} /></button>
        </span>
      )}
      {open && (
        <div className="inbox-row__detail">
          <div className="inbox-row__lines">{[...lines].reverse().map((line) => <span className="feed-bubble" key={line.key}>{line.text}</span>)}</div>
          {item.plain && <p className="feed-hint">{text.plainHint}</p>}
          {item.otp && <FeedOtp code={item.otp} copy={actions.copy} />}
          <div className="inbox-row__actions">
            <button type="button" className="feed-button feed-button--solid" onClick={() => actions.open(item)}><ArrowUpRight size={14} strokeWidth={1.8} />{item.source === "qqMail" ? text.open : text.openIn(app)}</button>
            <button type="button" className="feed-button" onClick={() => copy(item.key, fullText)}>{copied === item.key ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.8} />}{copied === item.key ? text.copied : text.copy}</button>
            {unread > 0 && <button type="button" className="feed-button" onClick={() => actions.read(lines)}><Check size={14} strokeWidth={2} />{text.read}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
