import { Check, Settings2 } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { FeedItem } from "../feed/feedModel";
import type { FeedSourceState } from "../feed/types";
import type { MessageSource } from "../messagePreview";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { FeedStatus } from "./FeedStatusLine";
import { clockText } from "./FeedTime";

export function FeedEmpty({ sources, items, now, scope, onOpenSettings }: {
  sources: readonly FeedSourceState[];
  items: readonly FeedItem[];
  now: number;
  scope?: MessageSource | null;
  onOpenSettings?: () => void;
}) {
  const t = useTranslation();
  const feed = t.messages.feed;
  const shown = scope ? sources.filter((source) => source.id === scope) : sources;
  const pool = scope ? items.filter((item) => item.source === scope) : items;
  const last = pool[0];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayCount = pool.filter((item) => item.at >= today.getTime()).length;
  if (sources.length === 0) {
    return (
      <div className="feed-empty" role="status">
        <h4>{feed.noSources}</h4>
        {onOpenSettings && <button type="button" className="feed-button feed-button--solid" onClick={onOpenSettings}><Settings2 size={14} strokeWidth={1.8} aria-hidden="true" />{feed.openSettings}</button>}
      </div>
    );
  }
  const scopeLabel = scope ? sources.find((source) => source.id === scope)?.label ?? "" : "";
  return (
    <div className="feed-empty" role="status">
      <span className="feed-empty__logos" aria-hidden="true">
        {shown.slice(0, 3).map((source) => <span className="feed-empty__logo" key={source.id}><MessageSourceIcon source={source.id} size={30} /></span>)}
        <span className="feed-empty__check"><Check size={13} strokeWidth={2.6} /></span>
      </span>
      <h4>{scope ? feed.doneSource(scopeLabel) : feed.doneTitle}</h4>
      {last && <p>{feed.lastMessage(clockText(last.at, t.localeTag), t.messages.sourceLabels[last.source], last.title)}{todayCount > 0 ? ` · ${feed.todayCount(todayCount)}` : ""}</p>}
      <span className="feed-status-line">{shown.map((source) => <FeedStatus key={source.id} source={source} />)}</span>
    </div>
  );
}
