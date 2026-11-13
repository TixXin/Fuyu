import { Braces, CornerDownLeft, ImageIcon, Link2, Star, TextQuote } from "lucide-react";
import { useRef, type MouseEvent, type PointerEvent } from "react";
import { formatAgo } from "../../components/list/formatAgo";
import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem, ClipboardSnippet } from "./api";
import { ClipboardEntryIcon } from "./ClipboardEntryIcon";
import { contentKind, linkLabel } from "./contentKind";
import { fileFolder, fileImageLabel, sourceName } from "./fileEntry";
import { formatBytes } from "../../utils/bytes";
import { useLinkPreview } from "./useLinkPreview";

const DRAG_DISTANCE = 5;

export function ClipboardPopupRow({ index, now, selected, queued, entry, snippet, linkPreview = false, onPick, onHover, onToggleFavorite, onMenu, onDrag }: {
  index: number;
  now: number;
  selected: boolean;
  queued: number;
  entry?: ClipboardHistoryItem;
  snippet?: ClipboardSnippet;
  linkPreview?: boolean;
  onPick: (event: MouseEvent) => void;
  onHover: () => void;
  onToggleFavorite?: () => void;
  onMenu?: () => void;
  onDrag?: () => void;
}) {
  const t = useTranslation();
  const text = t.clipboard;
  const image = entry?.kind === "image" ? entry.image : undefined;
  const fileThumbnail = entry?.kind === "files" ? entry.fileImage?.thumbnailDataUrl : undefined;
  const folder = entry?.kind === "files" && entry.files?.[0] ? fileFolder(entry.files[0]) : null;
  const kind = entry ? contentKind(entry) : null;
  const site = useLinkPreview(kind?.kind === "link" ? kind.url.href : null, linkPreview);
  const pressed = useRef<{ x: number; y: number } | null>(null);
  const draggable = Boolean(onDrag && (image || entry?.kind === "files"));
  const ago = entry ? formatAgo(entry.copiedAt, now, t.common.ago) : null;
  const main = entry ? (image ? text.imageLabel(image.width, image.height) : kind?.kind === "link" ? linkLabel(kind.url) : entry.preview) : snippet?.title ?? "";
  const extraFiles = entry?.kind === "files" && entry.files && entry.files.length > 1 ? entry.files.length - 1 : 0;
  const meta = entry
    ? [sourceName(entry, t.settings.project.appName, text.popup.screenshotSource), fileImageLabel(entry, formatBytes), folder, extraFiles > 0 ? text.moreFiles(extraFiles) : null, entry.note]
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
        title={draggable ? text.popup.dragOut : undefined}
        onClick={onPick}
        onPointerDown={(event: PointerEvent) => {
          pressed.current = draggable && event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
        }}
        onPointerUp={() => {
          pressed.current = null;
        }}
        onPointerMove={(event: PointerEvent) => {
          const start = pressed.current;
          if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_DISTANCE) return;
          pressed.current = null;
          onDrag?.();
        }}
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
          ) : fileThumbnail ? (
            <img src={fileThumbnail} alt="" />
          ) : kind?.kind === "color" ? (
            <span className="clipboard-popup__swatch" style={{ background: `rgba(${kind.color.r}, ${kind.color.g}, ${kind.color.b}, ${kind.color.a})` }} />
          ) : kind?.kind === "link" ? (
            site?.icon ? <img src={site.icon} alt="" /> : <Link2 size={15} strokeWidth={1.8} />
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
        {!selected && ago && <span className="clipboard-popup__time">{ago}</span>}
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
