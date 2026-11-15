import type { ClipboardHistoryItem } from "./api";

type LabelText = {
  imageLabel: (width: number, height: number) => string;
  manage: { count: (count: number) => string };
};

export function withoutPending(items: readonly ClipboardHistoryItem[], pending: readonly ClipboardHistoryItem[] | null): readonly ClipboardHistoryItem[] {
  if (!pending || pending.length === 0) return items;
  const gone = new Set(pending.map((item) => item.id));
  return items.filter((item) => !gone.has(item.id));
}

export function deletedLabel(pending: readonly ClipboardHistoryItem[], text: LabelText): string {
  if (pending.length !== 1) return text.manage.count(pending.length);
  const [item] = pending;
  return item.kind === "image" ? text.imageLabel(item.image?.width ?? 0, item.image?.height ?? 0) : [...item.preview].slice(0, 16).join("");
}
