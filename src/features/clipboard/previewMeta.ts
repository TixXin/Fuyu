import type { ClipboardHistoryItem } from "./api";
import { sourceName } from "./fileEntry.ts";

export type PreviewMetaRow = {
  key: "source" | "copiedAt" | "note" | "tags";
  label: string;
  value: string;
  multiline?: boolean;
};

export type PreviewMetaLabels = {
  source: string;
  copiedAt: string;
  note: string;
  tags: string;
  none: string;
  appName: string;
  screenshotSource: string;
  otherDevice: string;
};

export function previewNote(note?: string): string | null {
  const trimmed = note?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function previewMetaRows(item: ClipboardHistoryItem, copiedAt: string, labels: PreviewMetaLabels): PreviewMetaRow[] {
  const rows: PreviewMetaRow[] = [
    {
      key: "source",
      label: labels.source,
      value: sourceName(item, labels.appName, labels.screenshotSource, labels.otherDevice) ?? labels.none,
    },
    {
      key: "copiedAt",
      label: labels.copiedAt,
      value: copiedAt,
    },
  ];
  const note = previewNote(item.note);
  if (note) {
    rows.push({ key: "note", label: labels.note, value: note, multiline: true });
  }
  rows.push({
    key: "tags",
    label: labels.tags,
    value: item.tags?.length ? item.tags.map((tag) => `#${tag}`).join(" ") : labels.none,
  });
  return rows;
}
