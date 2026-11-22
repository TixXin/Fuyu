import { useTranslation } from "../../../i18n";
import { activityDots, type FeedItem } from "../feed/feedModel";
import type { MessageSource } from "../messagePreview";
import { clockText } from "./FeedTime";

const SPAN_MS = 12 * 3_600_000;
const TICKS = [12, 9, 6, 3];

export function TimelineStrip({ items, now, hidden }: { items: readonly FeedItem[]; now: number; hidden: ReadonlySet<MessageSource> }) {
  const t = useTranslation();
  const dots = activityDots(items, now, SPAN_MS);
  return (
    <div className="timeline-strip" aria-hidden="true">
      {dots.map((dot) => (
        <span key={dot.key} className="timeline-strip__dot" data-source={dot.source} data-hidden={hidden.has(dot.source) || undefined} style={{ left: `calc(6px + (100% - 12px) * ${dot.ratio})` }} />
      ))}
      <span className="timeline-strip__now" />
      {TICKS.map((hours) => <span key={hours} className={hours === 12 ? "timeline-strip__tick timeline-strip__tick--start" : "timeline-strip__tick"} style={{ left: `calc(6px + (100% - 12px) * ${1 - hours / 12})` }}>{clockText(now - hours * 3_600_000, t.localeTag)}</span>)}
      <span className="timeline-strip__tick timeline-strip__tick--now">{t.messages.feed.now}</span>
    </div>
  );
}
