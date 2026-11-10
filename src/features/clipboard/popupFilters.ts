import type { ClipboardHistoryItem } from "./api";
import { contentKind } from "./contentKind.ts";
import { matchesPopupQuery, type PopupQuery } from "./popupQuery.ts";

/** The clipboard window's filter chips: kinds of entry, the snippets, then the most used tags. */
export type PopupFilter = "all" | "favorites" | "images" | "files" | "links" | "colors" | "snippets" | `#${string}`;

const KINDS: readonly PopupFilter[] = ["all", "favorites", "images", "files", "links", "colors", "snippets"];

/** The tags used most, the most used first; at most `limit`. */
export function popupTags(items: readonly ClipboardHistoryItem[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const item of items) for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([tag]) => tag);
}

/** Every chip, in order. */
export function popupFilters(tags: readonly string[]): PopupFilter[] {
  return [...KINDS, ...tags.map((tag) => `#${tag}` as const)];
}

/** The chip after `current` (Tab), or before it (Shift+Tab), wrapping round. */
export function nextPopupFilter(filters: readonly PopupFilter[], current: PopupFilter, back: boolean): PopupFilter {
  const index = Math.max(0, filters.indexOf(current));
  return filters[(index + (back ? -1 : 1) + filters.length) % filters.length];
}

/** The history entries a chip and the search (parsePopupQuery) leave. */
export function filterPopupItems(items: readonly ClipboardHistoryItem[], filter: PopupFilter, query: PopupQuery, now = Date.now()): ClipboardHistoryItem[] {
  const empty = query.words.length === 0 && query.rules.length === 0;
  return items.filter((item) => {
    if (filter === "favorites" && !item.favorite) return false;
    if (filter === "images" && item.kind !== "image") return false;
    if (filter === "files" && item.kind !== "files") return false;
    if (filter === "links" && contentKind(item)?.kind !== "link") return false;
    if (filter === "colors" && contentKind(item)?.kind !== "color") return false;
    if (filter.startsWith("#") && !(item.tags ?? []).some((tag) => tag.toLowerCase() === filter.slice(1).toLowerCase())) return false;
    return empty || matchesPopupQuery(item, query, now);
  });
}
