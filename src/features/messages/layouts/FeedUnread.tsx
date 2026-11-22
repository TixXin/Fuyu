import { useTranslation } from "../../../i18n";
import { mailBadgeCount } from "../messagePreview";

export function FeedUnread({ count, dot = false }: { count: number; dot?: boolean }) {
  const t = useTranslation();
  if (count <= 0) return null;
  if (dot || count === 1) return <span className="feed-unread-dot" role="img" aria-label={t.messages.feed.unread(count)} />;
  return <span className="feed-unread" aria-label={t.messages.feed.unread(count)}>{mailBadgeCount(count)}</span>;
}
