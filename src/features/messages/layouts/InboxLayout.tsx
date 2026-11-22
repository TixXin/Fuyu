import { CheckCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "../../../i18n";
import { groupByBucket, groupRuns } from "../feed/feedModel";
import type { MessageSource } from "../messagePreview";
import { FeedEmpty } from "./FeedEmpty";
import { FeedMoreMenu, LayoutMenu } from "./FeedMenus";
import { FeedNotices } from "./FeedNotices";
import { FeedStatusLine } from "./FeedStatusLine";
import { InboxRow } from "./InboxRow";
import type { FeedLayoutProps } from "./layoutProps";
import { SourceChips } from "./SourceChips";
import "./InboxLayout.css";

export function InboxLayout({ feed, chrome, onOpenSettings }: FeedLayoutProps) {
  const t = useTranslation();
  const text = t.messages.feed;
  const { items, sources, now, actions } = feed;
  const [filter, setFilter] = useState<MessageSource | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const shown = useMemo(() => items.filter((item) => !filter || item.source === filter), [filter, items]);
  const groups = useMemo(() => groupByBucket(shown, now).map((group) => ({ bucket: group.bucket, runs: groupRuns(group.items) })), [now, shown]);
  const unread = shown.some((item) => item.unread > 0);
  return (
    <section className="feed-layout inbox-layout" aria-label={text.layouts.inbox.name}>
      <header className="feed-head">
        <SourceChips sources={sources} items={items} value={filter} onChange={(next) => { setFilter(next); setOpenKey(null); }} />
        <span className="feed-tools">
          <button type="button" className="feed-button inbox-layout__read-all" aria-label={text.readAll} disabled={!unread} onClick={() => actions.readAll(filter ?? undefined)}><CheckCheck size={14} strokeWidth={1.8} aria-hidden="true" /><span>{text.readAll}</span></button>
          <LayoutMenu layout={chrome.layout} onLayout={chrome.onLayout} />
          <FeedMoreMenu feed={feed} chrome={chrome} source={filter} />
        </span>
      </header>
      <FeedNotices sources={sources} actions={actions} only={filter} />
      {shown.length === 0 ? (
        <FeedEmpty sources={sources} items={items} now={now} scope={filter} onOpenSettings={onOpenSettings} />
      ) : (
        <div className="inbox-layout__list feed-scroll" role="list" aria-label={text.list}>
          {groups.map((group) => (
            <div className="inbox-layout__group" key={group.bucket}>
              <div className="inbox-layout__bucket">{text.buckets[group.bucket]}</div>
              {group.runs.map((run) => (
                <InboxRow key={run.key} run={run} now={now} actions={actions} open={openKey === run.key} onToggle={() => setOpenKey((previous) => (previous === run.key ? null : run.key))} />
              ))}
            </div>
          ))}
        </div>
      )}
      {shown.length > 0 && <footer className="inbox-layout__foot"><FeedStatusLine sources={filter ? sources.filter((source) => source.id === filter) : sources} /></footer>}
    </section>
  );
}
