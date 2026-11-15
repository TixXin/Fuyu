import type { ClipboardHistoryItem } from "./api";

export type RecentRange = "15m" | "1h" | "today";

export const RECENT_RANGES: readonly RecentRange[] = ["15m", "1h", "today"];

export function rangeStart(range: RecentRange, now: number): number {
  if (range === "15m") return now - 15 * 60_000;
  if (range === "1h") return now - 60 * 60_000;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}

export function recentItems(items: readonly ClipboardHistoryItem[], range: RecentRange, now: number): ClipboardHistoryItem[] {
  const start = rangeStart(range, now);
  return items.filter((item) => !item.favorite && item.copiedAt >= start);
}
