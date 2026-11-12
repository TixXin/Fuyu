import type { ClipboardHistoryItem } from "./api";

export function matchesClipboardQuery(item: ClipboardHistoryItem, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tags = (item.tags ?? []).map((tag) => tag.toLowerCase());
  const haystack = [
    item.preview,
    item.masked ? "" : item.text ?? "",
    item.note ?? "",
    ...(item.files ?? []),
    item.ocrText ?? "",
    item.source?.name ?? "",
  ].join("\n").toLowerCase();
  return words.every((word) => (word.startsWith("#") && word.length > 1 ? tags.includes(word.slice(1)) : haystack.includes(word)));
}
