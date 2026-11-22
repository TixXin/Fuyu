import { useTranslation } from "../../../i18n";
import { unreadTotal, type FeedItem } from "../feed/feedModel";
import type { FeedSourceState } from "../feed/types";
import type { MessageSource } from "../messagePreview";
import { MessageSourceIcon } from "../MessageSourceIcon";

export function SourceChips({ sources, items, value, onChange }: {
  sources: readonly FeedSourceState[];
  items: readonly FeedItem[];
  value: MessageSource | null;
  onChange: (source: MessageSource | null) => void;
}) {
  const t = useTranslation();
  const all = unreadTotal(items);
  return (
    <div className="feed-chips" role="group" aria-label={t.messages.feed.filter}>
      <button type="button" className="feed-chip feed-chip--text" aria-pressed={value === null} onClick={() => onChange(null)}>
        {t.messages.feed.all}{all > 0 && <span className="feed-chip__count">{all}</span>}
      </button>
      {sources.map((source) => (
        <button type="button" className="feed-chip" key={source.id} aria-pressed={value === source.id} data-off={source.status === "off" || undefined} onClick={() => onChange(source.id)}>
          <MessageSourceIcon source={source.id} size={16} />
          {source.label}
          {source.unread > 0 && <span className="feed-chip__count">{source.unread}</span>}
        </button>
      ))}
    </div>
  );
}
