import { formatAgo } from "../../../components/list/formatAgo";
import { useTranslation } from "../../../i18n";

export function FeedTime({ at, now }: { at: number; now: number }) {
  const t = useTranslation();
  if (!at) return null;
  return <time className="feed-time" dateTime={new Date(at).toISOString()}>{formatAgo(at, now, t.common.ago)}</time>;
}

export function clockText(at: number, localeTag: string) {
  return new Date(at).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });
}
