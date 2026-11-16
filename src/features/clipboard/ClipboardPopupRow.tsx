import { CornerDownLeft, GripVertical, Star, Trash2 } from "lucide-react";
import { memo, useRef, type MouseEvent, type PointerEvent } from "react";
import { formatAgo } from "../../components/list/formatAgo";
import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem, ClipboardSnippet } from "./api";
import { contentKind } from "./contentKind";
import { ClipboardRowLead } from "./ClipboardRowLead";
import { ALT_KEY } from "./pins";
import type { PinGrip } from "./usePopupPins";
import { entryMainLabel, entryMetaLabel } from "./rowLabels";
import { useLinkPreview } from "./useLinkPreview";

const DRAG_DISTANCE = 5;

export type PopupRowActions = {
  pick: (index: number, event: MouseEvent) => void;
  hover: (index: number) => void;
  favorite?: (index: number) => void;
  remove?: (index: number) => void;
  menu?: (index: number) => void;
  drag?: (index: number) => void;
};

export const ClipboardPopupRow = memo(function ClipboardPopupRow({ index, slot = index, pinned = false, grip, dragging = false, now, selected, queued, entry, snippet, linkPreview = false, actions }: {
  index: number;
  slot?: number | null;
  pinned?: boolean;
  grip?: PinGrip;
  dragging?: boolean;
  now: number;
  selected: boolean;
  queued: number;
  entry?: ClipboardHistoryItem;
  snippet?: ClipboardSnippet;
  linkPreview?: boolean;
  actions: PopupRowActions;
}) {
  const t = useTranslation();
  const text = t.clipboard;
  const image = entry?.kind === "image" ? entry.image : undefined;
  const kind = entry ? contentKind(entry) : null;
  const site = useLinkPreview(kind?.kind === "link" ? kind.url.href : null, linkPreview);
  const pressed = useRef<{ x: number; y: number } | null>(null);
  const draggable = Boolean(actions.drag && (image || entry?.kind === "files"));
  const pinKey = pinned ? entry?.pinKey : undefined;
  const ago = entry ? formatAgo(entry.copiedAt, now, t.common.ago) : null;
  const main = entry ? entryMainLabel(entry, kind, text) : snippet?.title ?? "";
  const meta = entry ? entryMetaLabel(entry, t) : snippet?.text.replace(/\s*\n\s*/g, " ⏎ ") ?? "";
  const className = ["clipboard-popup__item", selected ? "clipboard-popup__item--selected" : "", queued ? "clipboard-popup__item--queued" : "", dragging ? "clipboard-popup__item--dragging" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <li data-index={index} data-pinned={pinned || undefined} role="option" aria-selected={selected} className={className} onPointerMove={() => !selected && actions.hover(index)}>
      <button
        className="clipboard-popup__row"
        type="button"
        tabIndex={-1}
        title={draggable ? text.popup.dragOut : undefined}
        onClick={(event) => actions.pick(index, event)}
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
          actions.drag?.(index);
        }}
        onContextMenu={(event) => {
          if (!actions.menu) return;
          event.preventDefault();
          event.stopPropagation();
          actions.menu(index);
        }}
      >
        <span className={`clipboard-popup__index${pinKey ? " clipboard-popup__index--key" : ""}`} title={pinKey && !queued ? `${ALT_KEY}${pinKey}` : undefined} aria-label={queued ? undefined : pinKey ? t.clipboardList.pinKeyPaste(`${ALT_KEY}${pinKey}`) : slot !== null && slot < 9 ? text.popup.quickPaste(slot + 1) : undefined}>
          {queued ? queued : pinKey ? pinKey : slot !== null && slot < 9 ? slot + 1 : ""}
        </span>
        <ClipboardRowLead entry={entry} kind={kind} siteIcon={site?.icon} />
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
        {grip && (selected || dragging) && (
          <span className="clipboard-popup__star clipboard-popup__grip" role="presentation" title={t.clipboardList.dragPin} onPointerDown={grip.onPointerDown} onPointerMove={grip.onPointerMove} onPointerUp={grip.onPointerUp} onPointerCancel={grip.onPointerUp}>
            <GripVertical size={13} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        {entry && actions.favorite && (selected || entry.favorite) && (
          <button
            className={`clipboard-popup__star${entry.favorite ? " clipboard-popup__star--on" : ""}`}
            type="button"
            tabIndex={-1}
            aria-label={entry.favorite ? text.unfavoriteItem : text.favoriteItem}
            aria-pressed={Boolean(entry.favorite)}
            onClick={() => actions.favorite?.(index)}
          >
            <Star size={13} strokeWidth={2} fill={entry.favorite ? "currentColor" : "none"} />
          </button>
        )}
        {entry && actions.remove && selected && (
          <button
            className="clipboard-popup__star clipboard-popup__delete"
            type="button"
            tabIndex={-1}
            aria-label={text.deleteItem}
            title={text.deleteItem}
            onClick={() => actions.remove?.(index)}
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        )}
      </span>
    </li>
  );
});
