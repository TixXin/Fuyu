import type { ClipboardHistoryItem } from "./api";
import { contentKind, linkLabel } from "./contentKind.ts";

export type CopyNoticeLabel =
  | { kind: "text"; summary: string }
  | { kind: "masked" }
  | { kind: "image" }
  | { kind: "files"; name: string; more: number };

const MAX_SUMMARY = 80;

export function copyNoticeLabel(item: ClipboardHistoryItem): CopyNoticeLabel {
  if (item.kind === "image") return { kind: "image" };
  if (item.kind === "files") {
    const files = item.files ?? [];
    const name = files[0]?.split(/[\\/]+/).filter(Boolean).pop() ?? item.preview;
    return { kind: "files", name, more: Math.max(0, files.length - 1) };
  }
  if (item.masked) return { kind: "masked" };
  const kind = contentKind(item);
  const raw = kind?.kind === "link" ? linkLabel(kind.url) : item.preview || item.text || "";
  const flat = raw.replace(/\s+/g, " ").trim();
  return { kind: "text", summary: flat.length > MAX_SUMMARY ? `${flat.slice(0, MAX_SUMMARY - 1)}…` : flat };
}

export function copyNoticeThumbnail(item: ClipboardHistoryItem): string | null {
  if (item.kind === "image") return item.image?.thumbnailDataUrl ?? null;
  if (item.kind === "files") return item.fileImage?.thumbnailDataUrl ?? null;
  return null;
}
