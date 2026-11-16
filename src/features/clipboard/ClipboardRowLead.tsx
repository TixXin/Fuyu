import { Braces, ImageIcon, Link2, TextQuote } from "lucide-react";
import type { ClipboardHistoryItem } from "./api";
import { ClipboardEntryIcon } from "./ClipboardEntryIcon";
import type { ContentKind } from "./contentKind";

export function ClipboardRowLead({ entry, kind, siteIcon }: { entry?: ClipboardHistoryItem; kind: ContentKind | null; siteIcon?: string | null }) {
  const image = entry?.kind === "image" ? entry.image : undefined;
  const fileThumbnail = entry?.kind === "files" ? entry.fileImage?.thumbnailDataUrl : undefined;
  return (
    <span className="clipboard-popup__lead" aria-hidden="true">
      {image ? (
        image.thumbnailDataUrl ? <img src={image.thumbnailDataUrl} alt="" decoding="async" /> : <ImageIcon size={15} strokeWidth={1.8} />
      ) : fileThumbnail ? (
        <img src={fileThumbnail} alt="" decoding="async" />
      ) : kind?.kind === "color" ? (
        <span className="clipboard-popup__swatch" style={{ background: `rgba(${kind.color.r}, ${kind.color.g}, ${kind.color.b}, ${kind.color.a})` }} />
      ) : kind?.kind === "link" ? (
        siteIcon ? <img src={siteIcon} alt="" /> : <Link2 size={15} strokeWidth={1.8} />
      ) : kind?.kind === "json" ? (
        <Braces size={15} strokeWidth={1.8} />
      ) : entry ? (
        <ClipboardEntryIcon item={entry} />
      ) : (
        <TextQuote size={15} strokeWidth={1.8} />
      )}
    </span>
  );
}
