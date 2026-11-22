import { Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "../../../i18n";
import { unreadTotal } from "../feed/feedModel";
import { MailPanel } from "../mail/MailPanel";
import type { MessageSource } from "../messagePreview";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { FeedAvatar } from "./FeedAvatar";
import { FeedEmpty } from "./FeedEmpty";
import { FeedMoreMenu, LayoutMenu } from "./FeedMenus";
import { FeedNotices } from "./FeedNotices";
import { FeedStatus } from "./FeedStatusLine";
import { FeedTime } from "./FeedTime";
import { FeedUnread } from "./FeedUnread";
import type { FeedLayoutProps } from "./layoutProps";
import { ReaderDetail } from "./ReaderDetail";
import "./ReaderLayout.css";

export function ReaderLayout({ feed, chrome, mail, onOpenSettings }: FeedLayoutProps) {
  const t = useTranslation();
  const text = t.messages.feed;
  const { items, sources, now, actions } = feed;
  const [filter, setFilter] = useState<MessageSource | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const shown = useMemo(() => items.filter((item) => !filter || item.source === filter), [filter, items]);
  const selected = shown.find((item) => item.key === selectedKey) ?? (mail.selectedMail ? undefined : shown.find((item) => item.source !== "qqMail"));
  const thread = selected ? shown.filter((item) => item.conversation === selected.conversation && item.source !== "qqMail") : [];
  const current = filter ? sources.find((source) => source.id === filter) : null;
  const pick = (key: string) => {
    const item = shown.find((entry) => entry.key === key);
    setSelectedKey(key);
    if (item?.source === "qqMail") actions.open(item);
    else mail.closeReader();
  };
  const railButton = (id: MessageSource | null, label: string, count: number, off = false) => (
    <button type="button" key={id ?? "all"} className="reader-rail__item" aria-pressed={filter === id} data-off={off || undefined} onClick={() => { setFilter(id); mail.closeReader(); setSelectedKey(null); }}>
      {id ? <MessageSourceIcon source={id} size={24} /> : <span className="reader-rail__all"><Layers size={15} strokeWidth={1.8} /></span>}
      <span className="reader-rail__label">{label}</span>
      {count > 0 && <span className="reader-rail__count">{count > 99 ? "99+" : count}</span>}
    </button>
  );
  return (
    <section className="feed-layout reader-layout" data-picked={selectedKey !== null || mail.selectedMail !== null || undefined} aria-label={text.layouts.reader.name}>
      <nav className="reader-rail" aria-label={text.filter}>
        {railButton(null, text.all, unreadTotal(items))}
        {sources.map((source) => railButton(source.id, source.label, source.unread, source.status === "off"))}
      </nav>
      <div className="reader-list">
        <header className="feed-head">
          <span className="feed-head__title">{current?.label ?? text.all}</span>
          {current ? <FeedStatus source={current} /> : <span className="feed-head__count">{text.unread(unreadTotal(shown))}</span>}
          <span className="feed-tools"><LayoutMenu layout={chrome.layout} onLayout={chrome.onLayout} /><FeedMoreMenu feed={feed} chrome={chrome} source={filter} /></span>
        </header>
        <FeedNotices sources={sources} actions={actions} only={filter} compact />
        <div className="reader-list__items feed-scroll" role="listbox" aria-label={text.list}>
          {shown.length === 0 && <p className="reader-list__none">{text.nothingHere}</p>}
          {shown.map((item) => {
            const active = mail.selectedMail ? item.source === "qqMail" && item.id === mail.selectedMail.id : selected?.key === item.key;
            return (
              <button type="button" role="option" aria-selected={active} className="reader-item" key={item.key} onClick={() => pick(item.key)}>
                <FeedAvatar item={item} size={30} badge={filter === null} />
                <span className="reader-item__body">
                  <span className="reader-item__l1"><strong>{item.title}</strong><FeedTime at={item.at} now={now} /></span>
                  <span className="reader-item__l2"><span>{item.text}</span><FeedUnread count={item.unread} dot={item.source === "qqMail"} /></span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="reader-pane">
        {mail.selectedMail ? <MailPanel controller={mail} navigation={null} onOpenSettings={onOpenSettings} onBack={() => { mail.closeReader(); setSelectedKey(null); }} />
          : selected ? <ReaderDetail item={selected} thread={thread.length > 0 ? thread : [selected]} actions={actions} onBack={() => setSelectedKey(null)} />
            : shown.length === 0 ? <FeedEmpty sources={sources} items={items} now={now} scope={filter} onOpenSettings={onOpenSettings} />
              : <p className="reader-pane__pick">{text.pick}</p>}
      </div>
    </section>
  );
}
