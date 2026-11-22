import { ArrowLeft, ArrowUpRight, Check, Copy } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { FeedItem } from "../feed/feedModel";
import type { FeedActions } from "../feed/types";
import { FeedAvatar } from "./FeedAvatar";
import { FeedOtp, useCopied } from "./FeedOtp";
import { clockText } from "./FeedTime";

export function ReaderDetail({ item, thread, actions, onBack }: { item: FeedItem; thread: readonly FeedItem[]; actions: FeedActions; onBack: () => void }) {
  const t = useTranslation();
  const text = t.messages.feed;
  const app = t.messages.sourceLabels[item.source];
  const { copied, run: copy } = useCopied(actions.copy);
  const lines = [...thread].reverse();
  const unread = thread.filter((line) => line.unread > 0);
  return (
    <div className="reader-detail" data-source={item.source} key={item.conversation}>
      <header className="reader-detail__who">
        <button type="button" className="feed-icon-button reader-detail__back" aria-label={text.back} onClick={onBack}><ArrowLeft size={15} strokeWidth={1.8} /></button>
        <FeedAvatar item={item} size={38} />
        <span><strong>{item.title}</strong><span>{app} · {clockText(item.at, t.localeTag)}</span></span>
      </header>
      <div className="reader-detail__body feed-scroll">
        {lines.map((line) => <div key={line.key}><span className="feed-bubble">{line.text}</span><time>{clockText(line.at, t.localeTag)}</time></div>)}
        {item.plain && <p className="feed-hint">{text.plainHint}</p>}
        {item.otp && <FeedOtp code={item.otp} copy={actions.copy} />}
      </div>
      <footer className="reader-detail__actions">
        <button type="button" className="feed-button feed-button--solid" onClick={() => actions.open(item)}><ArrowUpRight size={14} strokeWidth={1.8} />{text.openIn(app)}</button>
        <button type="button" className="feed-button" onClick={() => copy(item.key, lines.map((line) => line.text).join("\n"))}>{copied === item.key ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.8} />}{copied === item.key ? text.copied : text.copy}</button>
        <span className="reader-detail__spacer" />
        {unread.length > 0 && <button type="button" className="feed-button" onClick={() => actions.read(unread)}><Check size={14} strokeWidth={2} />{text.read}</button>}
      </footer>
    </div>
  );
}
