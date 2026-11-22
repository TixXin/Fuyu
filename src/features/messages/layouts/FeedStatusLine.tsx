import { useTranslation } from "../../../i18n";
import type { FeedSourceState } from "../feed/types";

export function FeedStatus({ source }: { source: FeedSourceState }) {
  const t = useTranslation();
  return <span className="feed-status" data-status={source.status}><i aria-hidden="true" />{t.messages.feed.status[source.status](source.label)}</span>;
}

export function FeedStatusLine({ sources }: { sources: readonly FeedSourceState[] }) {
  return <span className="feed-status-line">{sources.map((source) => <FeedStatus key={source.id} source={source} />)}</span>;
}
