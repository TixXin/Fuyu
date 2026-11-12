import { Braces, CornerDownLeft, ImageIcon, Link2, Star, TextQuote } from "lucide-react";
import type { MouseEvent } from "react";
import { formatAgo } from "../../components/list/formatAgo";
import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem, ClipboardSnippet } from "./api";
import { ClipboardEntryIcon } from "./ClipboardEntryIcon";
import { contentKind, linkLabel } from "./contentKind";

export function ClipboardPopupRow({ index, now, selected, queued, entry, snippet, onPick, onHover, onToggleFavorite, onMenu }: {
  index: number;
  now: number;
  selected: boolean;
  queued: number;
  entry?: ClipboardHistoryItem;
  snippet?: ClipboardSnippet;
  onPick: (event: MouseEvent) => void;
  onHover: () => void;
  onToggleFavorite?: () => void;
  onMenu?: () => void;
}) {
  const t = useTranslation();
  const text = t.clipboard;
  const image = entry?.kind === "image" ? entry.image : undefined;
  const kind = entry ? contentKind(entry) : null;
  const main = entry ? (image ? text.imageLabel(image.width, image.height) : kind?.kind === "link" ? linkLabel(kind.url) : entry.preview) : snippet?.title ?? "";
  const extraFiles = entry?.kind === "files" && entry.files && entry.files.length > 1 ? entry.files.length - 1 : 0;
  const meta = entry
    ? [entry.source?.name, formatAgo(entry.copiedAt, now, t.common.ago), extraFiles > 0 ? text.moreFiles(extraFiles) : null, entry.note]
      .filter((part): part is string => Boolean(part))
      .join(" · ")
    : snippet?.text.replace(/\s*\n\s*/g, " ⏎ ") ?? "";
  const className = ["clipboard-popup__item", selected ? "clipboard-popup__item--selected" : "", queued ? "clipboard-popup__item--queued" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <li data-index={index} role="option" aria-selected={selected} className={className} onPointerMove={() => !selected && onHover()}>
      <button
        className="clipboard-popup__row"
        type="button"
        tabIndex={-1}
        onClick={onPick}
        onContextMenu={(event) => {
          if (!onMenu) return;
          event.preventDefault();
          event.stopPropagation();
          onMenu();
        }}
      >
        <span className="clipboard-popup__index" aria-label={!queued && index < 9 ? text.popup.quickPaste(index + 1) : undefined}>
          {queued ? queued : index < 9 ? index + 1 : ""}
        </span>
        <span className="clipboard-popup__lead" aria-hidden="true">
          {image ? (
            image.thumbnailDataUrl ? <img src={image.thumbnailDataUrl} alt="" /> : <ImageIcon size={15} strokeWidth={1.8} />
          ) : kind?.kind === "color" ? (
            <span className="clipboard-popup__swatch" style={{ background: `rgba(${kind.color.r}, ${kind.color.g}, ${kind.color.b}, ${kind.color.a})` }} />
          ) : kind?.kind === "link" ? (
            <Link2 size={15} strokeWidth={1.8} />
          ) : kind?.kind === "json" ? (
            <Braces size={15} strokeWidth={1.8} />
          ) : entry ? (
            <ClipboardEntryIcon item={entry} />
          ) : (
            <TextQuote size={15} strokeWidth={1.8} />
          )}
        </span>
        <span className="clipboard-popup__text">
          <span className={`clipboard-popup__preview${entry?.masked || kind?.kind === "color" || kind?.kind === "json" ? " clipboard-popup__preview--mono" : ""}`}>{main}</span>
          <span className="clipboard-popup__note">
            {entry?.tags?.map((tag) => <span className="clipboard-popup__tag" key={tag}>#{tag}</span>)}
            {meta}
            {kind && <span className="clipboard-popup__badge">{text.popup.actions.kinds[kind.kind]}</span>}
          </span>
        </span>
      </button>
      <span className="clipboard-popup__end">
        {selected && (
          <span className="clipboard-popup__enter" aria-hidden="true">
            <kbd><CornerDownLeft size={10} strokeWidth={2.4} /></kbd>
            {text.popup.paste}
          </span>
        )}
        {entry && onToggleFavorite && (selected || entry.favorite) && (
          <button
            className={`clipboard-popup__star${entry.favorite ? " clipboard-popup__star--on" : ""}`}
            type="button"
            tabIndex={-1}
            aria-label={entry.favorite ? text.unfavoriteItem : text.favoriteItem}
            aria-pressed={Boolean(entry.favorite)}
            onClick={onToggleFavorite}
          >
            <Star size={13} strokeWidth={2} fill={entry.favorite ? "currentColor" : "none"} />
          </button>
        )}
      </span>
    </li>
  );
}
