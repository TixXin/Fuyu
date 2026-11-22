import { useMemo, useState } from "react";
import { useTranslation } from "../../../i18n";
import { bucketOf, groupRuns, type FeedBucket } from "../feed/feedModel";
import type { MessageSource } from "../messagePreview";
import { FeedEmpty } from "./FeedEmpty";
import { FeedMoreMenu, LayoutMenu } from "./FeedMenus";
import { FeedNotices } from "./FeedNotices";
import { FeedOtp } from "./FeedOtp";
import { clockText } from "./FeedTime";
import { FeedUnread } from "./FeedUnread";
import type { FeedLayoutProps } from "./layoutProps";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { TimelineStrip } from "./TimelineStrip";
import "./TimelineLayout.css";

export function TimelineLayout({ feed, chrome, onOpenSettings }: FeedLayoutProps) {
  const t = useTranslation();
  const text = t.messages.feed;
  const { items, sources, now, actions } = feed;
  const [hidden, setHidden] = useState<ReadonlySet<MessageSource>>(new Set());
  const today = useMemo(() => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return items.filter((item) => item.at >= start.getTime());
  }, [items, now]);
  const rows = useMemo(() => {
    let lastDay: FeedBucket | null = null;
    return groupRuns(items.filter((item) => !hidden.has(item.source))).map((run) => {
      const bucket = bucketOf(run.item.at, now);
      const day = bucket === "recent" || bucket === "today" ? null : bucket;
      const showDay = day !== null && day !== lastDay;
      if (day) lastDay = day;
      return { run, day: showDay ? day : null, unread: run.lines.reduce((sum, line) => sum + line.unread, 0) };
    });
  }, [hidden, items, now]);
  const toggle = (source: MessageSource) => setHidden((previous) => {
    const next = new Set(previous);
    if (next.has(source)) next.delete(source); else next.add(source);
    return next;
  });
  return (
    <section className="feed-layout timeline-layout" aria-label={text.layouts.timeline.name}>
      <header className="timeline-layout__summary">
        <div className="feed-head">
          <b className="timeline-layout__count">{today.length}</b>
          <span className="feed-head__count">{text.today}</span>
          <span className="timeline-layout__legend">
            {sources.map((source) => (
              <button type="button" key={source.id} className="timeline-legend" data-source={source.id} aria-pressed={!hidden.has(source.id)} aria-label={hidden.has(source.id) ? source.label : text.hidden(source.label)} onClick={() => toggle(source.id)}>
                <i aria-hidden="true" />{source.label}<span>{today.filter((item) => item.source === source.id).length}</span>
              </button>
            ))}
          </span>
          <span className="feed-tools"><LayoutMenu layout={chrome.layout} onLayout={chrome.onLayout} /><FeedMoreMenu feed={feed} chrome={chrome} /></span>
        </div>
        {items.length > 0 && <TimelineStrip items={items} now={now} hidden={hidden} />}
      </header>
      <FeedNotices sources={sources} actions={actions} compact />
      {rows.length === 0 ? <FeedEmpty sources={sources} items={items} now={now} onOpenSettings={onOpenSettings} /> : (
        <ol className="timeline-layout__list feed-scroll" aria-label={text.list}>
          {rows.map(({ run, day, unread }) => [
              day && <li className="timeline-row timeline-row--day" key={`day-${run.key}`}><span className="timeline-row__time">{text.buckets[day]}</span><span className="timeline-row__node"><i /></span><span /></li>,
              <li className="timeline-row" data-source={run.item.source} key={run.key}>
                <span className="timeline-row__time">{clockText(run.item.at, t.localeTag)}</span>
                <span className="timeline-row__node"><MessageSourceIcon source={run.item.source} size={18} account={run.item.account} /></span>
                <div className="timeline-row__content">
                  <button type="button" className="timeline-row__who" onClick={() => actions.open(run.item)}>
                    <strong>{run.item.title}</strong>
                    {run.item.account && <span>{run.item.account}</span>}
                    <FeedUnread count={unread} dot={run.item.source === "qqMail"} />
                  </button>
                  <div className="timeline-row__lines">
                    {[...run.lines].reverse().map((line) => <span className="feed-bubble" key={line.key}>{line.text}</span>)}
                    {run.item.otp && <FeedOtp code={run.item.otp} copy={actions.copy} />}
                  </div>
                </div>
              </li>,
          ])}
        </ol>
      )}
    </section>
  );
}
