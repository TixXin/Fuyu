import { CheckCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "../../../i18n";
import { groupByConversation, unreadTotal } from "../feed/feedModel";
import { FeedEmpty } from "./FeedEmpty";
import { FeedMoreMenu, LayoutMenu } from "./FeedMenus";
import { FeedNotices } from "./FeedNotices";
import type { FeedLayoutProps } from "./layoutProps";
import { StackCard } from "./StackCard";
import "./StacksLayout.css";

export function StacksLayout({ feed, chrome, onOpenSettings }: FeedLayoutProps) {
  const t = useTranslation();
  const text = t.messages.feed;
  const { items, sources, now, actions } = feed;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const groups = useMemo(() => groupByConversation(items), [items]);
  const unread = unreadTotal(items);
  return (
    <section className="feed-layout stacks-layout" aria-label={text.layouts.stacks.name}>
      <header className="feed-head">
        <span className="stacks-layout__summary">{text.conversations(unread, groups.filter((group) => group.unread > 0).length)}</span>
        <span className="feed-tools">
          <button type="button" className="feed-icon-button" aria-label={text.readAll} disabled={unread === 0} onClick={() => actions.readAll()}><CheckCheck size={15} strokeWidth={1.8} /></button>
          <LayoutMenu layout={chrome.layout} onLayout={chrome.onLayout} />
          <FeedMoreMenu feed={feed} chrome={chrome} />
        </span>
      </header>
      <FeedNotices sources={sources} actions={actions} compact />
      {groups.length === 0 ? (
        <FeedEmpty sources={sources} items={items} now={now} onOpenSettings={onOpenSettings} />
      ) : (
        <div className="stacks-layout__grid feed-scroll" role="list" aria-label={text.list}>
          {groups.map((group) => (
            <StackCard key={group.key} group={group} now={now} actions={actions} open={openKey === group.key} onToggle={() => setOpenKey((previous) => (previous === group.key ? null : group.key))} />
          ))}
        </div>
      )}
    </section>
  );
}
