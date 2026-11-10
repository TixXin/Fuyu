import { Check, Copy, FileImage, ImageIcon, Pencil, ScanText, SquareTerminal, Star, Trash2, X } from "lucide-react";
import { RowMenu, type RowMenuItem } from "../../components/list/RowMenu";
import { formatAgo } from "../../components/list/formatAgo";
import { useTranslation } from "../../i18n";
import type { ClipboardCopyAs, ClipboardHistoryItem } from "./api";
import { ClipboardEntryIcon } from "./ClipboardEntryIcon";

/**
 * One entry on the island's clipboard page (IslandList.css): click it to copy it back; star and
 * copy show on hover, the rest (note, image copies, delete) is under "⋯".
 */
export function ClipboardHistoryItemRow({
  item,
  now,
  elementRef,
  isEditingNote,
  noteDraft,
  isSavingNote,
  isConfirmingDelete,
  copied,
  menuOpen,
  onMenuOpenChange,
  onCopy,
  onToggleFavorite,
  onStartEditNote,
  onNoteDraftChange,
  onSaveNote,
  onCancelEditNote,
  onDelete,
  onTag,
}: {
  item: ClipboardHistoryItem;
  now: number;
  elementRef: (node: HTMLElement | null) => void;
  isEditingNote: boolean;
  noteDraft: string;
  isSavingNote: boolean;
  isConfirmingDelete: boolean;
  /** Which copy just copied this item, or null. */
  copied: ClipboardCopyAs | null;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onCopy: (id: string, copyAs?: ClipboardCopyAs) => void;
  onToggleFavorite: (id: string) => void;
  onStartEditNote: (item: ClipboardHistoryItem) => void;
  onNoteDraftChange: (value: string) => void;
  onSaveNote: (id: string) => void;
  onCancelEditNote: () => void;
  onDelete: (id: string) => void;
  /** A tag was clicked: filter by it (C24.5). */
  onTag?: (tag: string) => void;
}) {
  const t = useTranslation();
  const text = t.clipboard;
  const image = item.kind === "image" ? item.image : undefined;
  const main = item.kind === "image" && image ? text.imageLabel(image.width, image.height) : item.preview;
  const extraFiles = item.kind === "files" && item.files && item.files.length > 1 ? item.files.length - 1 : 0;
  const meta = [
    item.source?.name,
    formatAgo(item.copiedAt, now, t.common.ago),
    extraFiles > 0 ? text.moreFiles(extraFiles) : null,
    item.note,
  ].filter((part): part is string => Boolean(part));

  // Images also go as the saved file or as its path, which terminal CLIs such as Claude Code take
  // as an image (C22.1).
  const menu: RowMenuItem[] = [
    { key: "note", label: text.noteAction, icon: <Pencil size={14} strokeWidth={2} />, onSelect: () => onStartEditNote(item) },
    ...(item.kind === "image"
      ? [
          { key: "file", label: text.copyAsFile, icon: <FileImage size={14} strokeWidth={2} />, onSelect: () => onCopy(item.id, "file") },
          { key: "path", label: text.copyPath, icon: <SquareTerminal size={14} strokeWidth={2} />, onSelect: () => onCopy(item.id, "path") },
          ...(item.ocrText ? [{ key: "text", label: text.copyOcrText, icon: <ScanText size={14} strokeWidth={2} />, onSelect: () => onCopy(item.id, "text") }] : []),
        ]
      : []),
    {
      key: "delete",
      label: isConfirmingDelete ? text.confirmDelete : text.deleteItem,
      icon: <Trash2 size={14} strokeWidth={2} />,
      danger: true,
      keepOpen: !isConfirmingDelete,
      onSelect: () => onDelete(item.id),
    },
  ];

  const className = ["island-list-row", menuOpen ? "island-list-row--menu" : ""].filter(Boolean).join(" ");
  return (
    <article className={className} role="listitem" ref={elementRef} data-clipboard-id={item.kind === "text" ? item.id : undefined}>
      <button className="island-list-row__hit" type="button" aria-label={`${text.copyBack}: ${main}`} onClick={() => onCopy(item.id)} />
      <span className="island-list-row__lead" aria-hidden="true">
        {item.kind === "image" ? (
          image?.thumbnailDataUrl ? <img src={image.thumbnailDataUrl} alt="" /> : <ImageIcon size={16} strokeWidth={1.8} />
        ) : (
          <ClipboardEntryIcon item={item} />
        )}
      </span>
      <span className="island-list-row__text">
        <span className={`island-list-row__main${item.masked ? " island-list-row__main--mono" : ""}`}>{main}</span>
        {isEditingNote ? (
          <form
            className="island-list-row__editor"
            onSubmit={(event) => {
              event.preventDefault();
              onSaveNote(item.id);
            }}
          >
            <input
              autoFocus
              value={noteDraft}
              maxLength={160}
              placeholder={text.notePlaceholder}
              aria-label={text.noteInputLabel}
              disabled={isSavingNote}
              onChange={(event) => onNoteDraftChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  onCancelEditNote();
                }
              }}
            />
            <button className="island-list-icon-button" type="submit" aria-label={text.saveNote} disabled={isSavingNote}>
              <Check size={14} strokeWidth={2.4} />
            </button>
            <button className="island-list-icon-button" type="button" aria-label={text.cancelEditNote} disabled={isSavingNote} onClick={onCancelEditNote}>
              <X size={14} strokeWidth={2.4} />
            </button>
          </form>
        ) : copied ? (
          <span className="island-list-row__meta island-list-row__meta--accent" role="status">
            <span>{text.copied}</span>
          </span>
        ) : (
          <span className="island-list-row__meta">
            {item.tags?.map((tag) => (
              <button key={tag} className="island-list-tag" type="button" aria-label={text.filterByTag(tag)} onClick={() => onTag?.(tag)}>
                #{tag}
              </button>
            ))}
            {meta.map((part, index) => (
              <span key={index}>{index > 0 ? `· ${part}` : part}</span>
            ))}
          </span>
        )}
      </span>
      {item.favorite && (
        <span className="island-list-row__mark" aria-hidden="true">
          <Star size={14} strokeWidth={2.2} fill="currentColor" />
        </span>
      )}
      <span className="island-list-row__actions">
        <button
          className={`island-list-icon-button${item.favorite ? " island-list-icon-button--on" : ""}`}
          type="button"
          aria-label={item.favorite ? text.unfavoriteItem : text.favoriteItem}
          title={item.favorite ? text.unfavoriteItem : text.favoriteItem}
          aria-pressed={Boolean(item.favorite)}
          onClick={() => onToggleFavorite(item.id)}
        >
          <Star size={14} strokeWidth={2.2} fill={item.favorite ? "currentColor" : "none"} />
        </button>
        <button className="island-list-icon-button" type="button" aria-label={text.copyBack} title={text.copyBack} onClick={() => onCopy(item.id)}>
          {copied === "original" ? <Check className="save-check-icon" size={14} strokeWidth={2.6} /> : <Copy size={14} strokeWidth={2.2} />}
        </button>
        <RowMenu label={t.common.more} items={menu} onOpenChange={onMenuOpenChange} />
      </span>
    </article>
  );
}
