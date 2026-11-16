import { Check, Minus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "../../i18n";
import { pasteClipboardText, type ClipboardHistoryItem } from "./api";
import { ClipboardManageRow, MANAGE_ROW_HEIGHT } from "./ClipboardManageRow";
import { ClipboardPopupPreview } from "./ClipboardPopupPreview";
import { deletedLabel } from "./pendingItems";
import { popupFilterLabel } from "./popupFilterLabel";
import { isPrimaryKey, PRIMARY_KEY } from "../../lib/shortcut/shortcut";
import { useClipboardManager } from "./useClipboardManager";
import { useVirtualRows } from "./useVirtualRows";
import "./ClipboardPopup.css";
import "./ClipboardPopupPanels.css";
import "./ClipboardManager.css";

export function ClipboardManager({ items, linkPreview = false, onToggleFavorite, onCollapse }: {
  items: readonly ClipboardHistoryItem[];
  linkPreview?: boolean;
  onToggleFavorite: (id: string) => void;
  onCollapse: () => void;
}) {
  const t = useTranslation();
  const text = t.clipboard.manage;
  const manager = useClipboardManager(items);
  const { shown, picked, focusIndex, deletion, click, move } = manager;
  const listRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rows = useVirtualRows(listRef, shown.length, MANAGE_ROW_HEIGHT);
  const { scrollToIndex } = rows;
  const pickedSet = new Set(picked);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    if (focusIndex >= 0) scrollToIndex(focusIndex);
  }, [focusIndex, scrollToIndex]);

  const onRowClick = useCallback((index: number, event: MouseEvent) => {
    click(index, { shift: event.shiftKey, toggle: isPrimaryKey(event) });
  }, [click]);
  const onRowCheck = useCallback((index: number, event: MouseEvent) => {
    click(index, { shift: event.shiftKey, toggle: true });
  }, [click]);

  const allPicked = shown.length > 0 && picked.length === shown.length;
  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key;
    const inInput = event.target === inputRef.current;
    const ctrl = isPrimaryKey(event) && !event.altKey;
    const typing = inInput && manager.query !== "";
    const handled = () => event.preventDefault();
    if (key === "ArrowDown" || key === "ArrowUp") {
      handled();
      move(focusIndex + (key === "ArrowDown" ? 1 : -1), event.shiftKey);
    } else if ((key === "Home" || key === "End") && !typing) {
      handled();
      move(key === "Home" ? 0 : shown.length - 1, event.shiftKey);
    } else if ((key === "PageDown" || key === "PageUp") && !typing) {
      handled();
      const page = Math.max(1, Math.floor((listRef.current?.clientHeight ?? 460) / MANAGE_ROW_HEIGHT) - 1);
      move(focusIndex + (key === "PageDown" ? page : -page), event.shiftKey);
    } else if (ctrl && key.toLowerCase() === "a" && !typing) {
      handled();
      manager.selectAll();
    } else if (ctrl && key.toLowerCase() === "z" && deletion.pending) {
      handled();
      deletion.undo();
    } else if ((key === "Delete" || (key === "Backspace" && ctrl)) && !typing) {
      handled();
      manager.removePicked();
    } else if (key === " " && !inInput && focusIndex >= 0) {
      handled();
      click(focusIndex, { toggle: true, shift: event.shiftKey });
    } else if (key === "Escape") {
      handled();
      if (picked.length > 0) manager.selectNone();
      else if (manager.query) manager.search("");
      else onCollapse();
    }
  };

  return (
    <section className="clipboard-popup clipboard-popup--wide clipboard-manage" aria-label={text.label} onKeyDown={onKeyDown}>
      <div className="clipboard-popup__top">
        <label className="clipboard-popup__search">
          <Search size={15} strokeWidth={2} aria-hidden="true" />
          <input ref={inputRef} value={manager.query} placeholder={t.clipboard.popup.search} aria-label={t.clipboard.popup.search} onChange={(event) => manager.search(event.currentTarget.value)} />
        </label>
        <div className="clipboard-popup__chips" role="tablist" aria-label={t.clipboard.popup.filters}>
          {manager.filters.map((chip) => (
            <button key={chip} type="button" role="tab" tabIndex={-1} aria-selected={manager.filter === chip} className={`clipboard-popup__chip${chip.startsWith("#") ? " clipboard-popup__chip--tag" : ""}`} onClick={() => manager.chooseFilter(chip)}>
              {popupFilterLabel(chip, t.clipboard)}
            </button>
          ))}
        </div>
      </div>
      <div className="clipboard-manage__bar">
        <button
          type="button"
          role="checkbox"
          aria-checked={allPicked ? true : picked.length > 0 ? "mixed" : false}
          aria-label={allPicked ? text.selectNone : text.selectAll}
          title={allPicked ? text.selectNone : text.selectAll}
          className="clipboard-manage__check"
          disabled={shown.length === 0}
          onClick={allPicked ? manager.selectNone : manager.selectAll}
        >
          {allPicked ? <Check size={11} strokeWidth={3} /> : picked.length > 0 ? <Minus size={11} strokeWidth={3} /> : null}
        </button>
        <span className="clipboard-manage__count" role="status">
          {picked.length > 0 ? text.selected(picked.length) : text.count(shown.length)}
          {manager.pickedFavorites > 0 && <em>{text.favoritesIncluded(manager.pickedFavorites)}</em>}
        </span>
        <button type="button" className="clipboard-manage__delete" disabled={picked.length === 0} onClick={manager.removePicked}>
          <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
          {text.deleteSelected(picked.length)}
        </button>
      </div>
      <div className="clipboard-popup__body">
        <ul ref={listRef} className="clipboard-manage__list" role="listbox" aria-multiselectable="true" aria-label={popupFilterLabel(manager.filter, t.clipboard)}>
          {rows.before > 0 && <li className="clipboard-manage__spacer" role="presentation" style={{ height: rows.before }} />}
          {shown.slice(rows.start, rows.end).map((entry, offset) => (
            <ClipboardManageRow
              key={entry.id}
              entry={entry}
              index={rows.start + offset}
              now={manager.now}
              picked={pickedSet.has(entry.id)}
              focused={rows.start + offset === focusIndex}
              onClick={onRowClick}
              onCheck={onRowCheck}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
          {rows.after > 0 && <li className="clipboard-manage__spacer" role="presentation" style={{ height: rows.after }} />}
          {shown.length === 0 && <li className="clipboard-popup__empty" role="status">{manager.query.trim() ? t.clipboard.popup.noMatch(manager.query.trim()) : t.clipboard.popup.empty}</li>}
        </ul>
        {manager.focused
          ? <ClipboardPopupPreview entry={manager.focused} linkPreview={linkPreview} onPasteText={(value) => void pasteClipboardText(value).catch((error: unknown) => console.error("Failed to paste text", error))} />
          : <aside className="clipboard-popup__pane clipboard-manage__nothing">{text.nothingFocused}</aside>}
      </div>
      {deletion.pending ? (
        <footer className="clipboard-popup__hint clipboard-popup__hint--toast" role="status">
          <span className="clipboard-popup__toast-text">{deletion.pending.length === 1 ? t.clipboard.popup.actions.deleted(deletedLabel(deletion.pending, t.clipboard)) : text.deleted(deletion.pending.length)}</span>
          <button type="button" tabIndex={-1} className="clipboard-popup__hint-end clipboard-popup__undo" onClick={deletion.undo}>
            <kbd>{PRIMARY_KEY} Z</kbd>{text.undo}
          </button>
        </footer>
      ) : (
        <footer className="clipboard-popup__hint">
          {manager.failed ? <span className="clipboard-popup__toast-text" role="status">{text.failed}</span> : (
            <>
              <span>{text.hintClick}</span>
              <span><kbd>{PRIMARY_KEY}</kbd>{text.hintToggle}</span>
              <span><kbd>⇧</kbd>{text.hintRange}</span>
              <span><kbd>{PRIMARY_KEY} A</kbd>{text.hintAll}</span>
              <span><kbd>Del</kbd>{text.hintDelete}</span>
            </>
          )}
          <span className="clipboard-popup__hint-end"><kbd>Esc</kbd></span>
        </footer>
      )}
    </section>
  );
}
