import type { Translations } from "../../i18n/types";
import { formatBytes } from "../../utils/bytes";
import type { ClipboardHistoryItem } from "./api";
import { linkLabel, type ContentKind } from "./contentKind";
import { fileFolder, fileImageLabel, sourceName } from "./fileEntry";

export function entryMainLabel(entry: ClipboardHistoryItem, kind: ContentKind | null, text: Translations["clipboard"]): string {
  if (entry.kind === "image" && entry.image) return text.imageLabel(entry.image.width, entry.image.height);
  return kind?.kind === "link" ? linkLabel(kind.url) : entry.preview;
}

export function entryMetaLabel(entry: ClipboardHistoryItem, t: Translations): string {
  const text = t.clipboard;
  const folder = entry.kind === "files" && entry.files?.[0] ? fileFolder(entry.files[0]) : null;
  const extraFiles = entry.kind === "files" && entry.files && entry.files.length > 1 ? entry.files.length - 1 : 0;
  return [sourceName(entry, t.settings.project.appName, text.popup.screenshotSource, t.clipboardPrivacy.otherDevice), fileImageLabel(entry, formatBytes), folder, extraFiles > 0 ? text.moreFiles(extraFiles) : null, entry.truncated ? t.clipboardPrivacy.truncated : null, entry.editedAt ? text.popup.actions.edited : null, entry.note]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
