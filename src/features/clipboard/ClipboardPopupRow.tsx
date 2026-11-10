import { CornerDownLeft, ImageIcon, Star, TextQuote } from "lucide-react";
import type { MouseEvent } from "react";
import { formatAgo } from "../../components/list/formatAgo";
import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem, ClipboardSnippet } from "./api";
import { ClipboardEntryIcon } from "./ClipboardEntryIcon";

/**
 * One row of the clipboard window, drawn like the island's list rows: the quick-paste digit (or the
 * row's place in a sequence being picked, C24.7), an icon or thumbnail, the content on one line and
 * where and when it came from under it. The picked row says what Enter does.
 */
export function ClipboardPopupRow({ index, now, selected, queued, entry, snippet, onPick, onHover, onToggleFavorite }: {
  index: number;
  now: number;
  selected: boolean;
  /** 1-based place in the sequence, or 0. */
  queued: number;
  entry?: ClipboardHistoryItem;
  snippet?: ClipboardSnippet;
  onPick: (event: MouseEvent) => void;
  onHover: () => void;
  onToggleFavorite?: () => void;
}) {
  const t = useTranslation();
  const text = t.clipboard;
  const image = entry?.kind === "image" ? entry.image : undefined;
  const main = entry ? (image ? text.imageLabel(image.width, image.height) : entry.preview) : snippet?.title ?? "";
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
      <button className="clipboard-popup__row" type="button" tabIndex={-1} onClick={onPick}>
        <span className="clipboard-popup__index" aria-label={!queued && index < 9 ? text.popup.quickPaste(index + 1) : undefined}>
          {queued ? queued : index < 9 ? index + 1 : ""}
        </span>
        <span className="clipboard-popup__lead" aria-hidden="true">
          {image ? (
            image.thumbnailDataUrl ? <img src={image.thumbnailDataUrl} alt="" /> : <ImageIcon size={15} strokeWidth={1.8} />
          ) : entry ? (
            <ClipboardEntryIcon item={entry} />
          ) : (
            <TextQuote size={15} strokeWidth={1.8} />
          )}
        </span>
        <span className="clipboard-popup__text">
          <span className={`clipboard-popup__preview${entry?.masked ? " clipboard-popup__preview--mono" : ""}`}>{main}</span>
          <span className="clipboard-popup__note">
            {entry?.tags?.map((tag) => <span className="clipboard-popup__tag" key={tag}>#{tag}</span>)}
            {meta}
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
