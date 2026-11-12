import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Copy, ExternalLink, FolderOpen, Pin, PinOff, X } from "lucide-react";
import { RowMenu } from "../../components/list/RowMenu";
import { useTranslation } from "../../i18n";
import type { FileShelfItem } from "./api";
import { formatFileSize } from "./fileShelf";
import { FileShelfItemIcon } from "./FileShelfItemIcon";
import type { SelectMode } from "./selection";

const DRAG_THRESHOLD_PX = 4;
const COPIED_FLASH_MS = 1_100;

function selectMode(event: ReactMouseEvent): SelectMode {
  if (event.shiftKey) return "range";
  return event.ctrlKey || event.metaKey ? "toggle" : "single";
}

function folderOf(item: FileShelfItem) {
  const folder = item.path.slice(0, Math.max(0, item.path.length - item.name.length)).replace(/[\\/]+$/, "");
  return folder || item.path;
}

export function FileShelfItemRow({
  item,
  isRecent,
  isSelected,
  menuOpen,
  onMenuOpenChange,
  onSelect,
  onDragOut,
  onOpen,
  onOpenFile,
  onCopy,
  onReveal,
  onTogglePin,
  onRemove,
}: {
  item: FileShelfItem;
  isRecent: boolean;
  isSelected: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onSelect: (id: string, mode: SelectMode) => void;
  onDragOut: (id: string) => void;
  onOpen: (id: string) => void;
  onOpenFile: (id: string) => void;
  onCopy: (id: string) => Promise<boolean>;
  onReveal: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslation();
  const text = t.fileShelf;
  const [copied, setCopied] = useState(false);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const isAvailable = !item.missing && !item.unreachable;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const press = (event: ReactPointerEvent) => {
    pressRef.current = event.button === 0 && isAvailable ? { x: event.clientX, y: event.clientY } : null;
  };
  const move = (event: ReactPointerEvent) => {
    const start = pressRef.current;
    if (!start) return;
    if ((event.buttons & 1) === 0) {
      pressRef.current = null;
      return;
    }
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_THRESHOLD_PX) return;
    pressRef.current = null;
    onDragOut(item.id);
  };
  const copy = () => void onCopy(item.id).then((ok) => setCopied(ok));

  const status = item.missing ? text.missing : item.unreachable ? text.unreachable : null;
  const className = [
    "island-list-row",
    "shelf-item",
    item.missing ? "shelf-item--missing" : "",
    isSelected ? "island-list-row--selected" : "",
    menuOpen ? "island-list-row--menu" : "",
    isRecent ? "shelf-item--recent" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={className} role="listitem" aria-selected={isSelected} data-shelf-id={item.id}>
      <button
        className="island-list-row__hit"
        type="button"
        aria-label={item.name}
        onPointerDown={press}
        onPointerMove={move}
        onPointerUp={() => {
          pressRef.current = null;
        }}
        onClick={(event) => onSelect(item.id, selectMode(event))}
        onDoubleClick={() => {
          if (isAvailable) onOpen(item.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && isAvailable) onOpen(item.id);
        }}
      />
      <FileShelfItemIcon id={item.id} name={item.name} isDir={item.isDir} available={isAvailable} />
      <span className="island-list-row__text">
        <span className="island-list-row__main shelf-item__name">{item.name}</span>
        {copied ? (
          <span className="island-list-row__meta island-list-row__meta--accent" role="status"><span>{text.copied}</span></span>
        ) : (
          <span className="island-list-row__meta">
            <span>{folderOf(item)}</span>
            <span className={status ? "island-list-row__warn" : undefined}>{`· ${status ?? (item.isDir ? text.folder : formatFileSize(item.size))}`}</span>
          </span>
        )}
      </span>
      {item.pinned && (
        <span className="island-list-row__mark" aria-hidden="true"><Pin size={14} strokeWidth={2.2} /></span>
      )}
      <span className="island-list-row__actions">
        <button
          className={`island-list-icon-button${item.pinned ? " island-list-icon-button--on" : ""}`}
          type="button"
          aria-label={item.pinned ? text.unpin : text.pin}
          title={item.pinned ? text.unpin : text.pin}
          aria-pressed={item.pinned}
          onClick={() => onTogglePin(item.id)}
        >
          {item.pinned ? <PinOff size={14} strokeWidth={2.2} /> : <Pin size={14} strokeWidth={2.2} />}
        </button>
        {isAvailable && (
          <button className="island-list-icon-button" type="button" aria-label={copied ? text.copied : text.copyItem} title={text.copyItem} onClick={copy}>
            {copied ? <Check size={14} strokeWidth={2.6} /> : <Copy size={14} strokeWidth={2.2} />}
          </button>
        )}
        <RowMenu
          label={t.common.more}
          onOpenChange={onMenuOpenChange}
          items={[
            { key: "open", label: text.open, icon: <ExternalLink size={14} strokeWidth={2} />, disabled: !isAvailable, onSelect: () => onOpenFile(item.id) },
            { key: "reveal", label: text.reveal, icon: <FolderOpen size={14} strokeWidth={2} />, disabled: !isAvailable, onSelect: () => onReveal(item.id) },
            { key: "remove", label: text.removeItem, icon: <X size={14} strokeWidth={2.2} />, danger: true, onSelect: () => onRemove(item.id) },
          ]}
        />
      </span>
    </article>
  );
}
