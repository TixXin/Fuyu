import { avatarLetter, avatarTone, type FeedItem } from "../feed/feedModel";
import { MessageSourceIcon } from "../MessageSourceIcon";

export function FeedAvatar({ item, size = 34, badge = true }: { item: Pick<FeedItem, "source" | "title" | "plain" | "account">; size?: number; badge?: boolean }) {
  const badgeSize = Math.max(12, Math.round(size * 0.44));
  return (
    <span className="feed-avatar" data-tone={item.plain ? "brand" : avatarTone(item.title)} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {item.plain ? <MessageSourceIcon source={item.source} size={Math.round(size * 0.62)} account={item.account} /> : avatarLetter(item.title)}
      {badge && !item.plain && <span className="feed-avatar__badge"><MessageSourceIcon source={item.source} size={badgeSize} account={item.account} /></span>}
    </span>
  );
}
