import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Inbox } from "lucide-react";
import { useTranslation } from "../../i18n";
import { FileShelfHeader, type ShelfView } from "./FileShelfHeader";
import { FileShelfItemRow } from "./FileShelfItemRow";
import { EMPTY_SELECTION, filterShelfItems, keepVisible, selectEntry, targetIds } from "./selection";
import type { FileShelfController } from "./useFileShelf";
import "../../components/list/IslandList.css";
import "./FileShelfPanel.css";

export function FileShelfPanel({
  shelf,
  isDropTarget,
  revealOnDoubleClick,
}: {
  shelf: FileShelfController;
  /** Files are being dragged over the island. */
  isDropTarget: boolean;
  /** Double-clicking (or Enter on) an entry shows it in its folder instead of opening it. */
  revealOnDoubleClick: boolean;
}) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ShelfView>("all");
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [rawSelection, setSelection] = useState(EMPTY_SELECTION);
  const listRef = useRef<HTMLDivElement>(null);
  const { items, error, recentDrop, refresh } = shelf;
  const recentIds = new Set(recentDrop?.ids ?? []);
  const visible = useMemo(
    () => filterShelfItems(view === "pinned" ? items.filter((item) => item.pinned) : items, query),
    [items, query, view],
  );
  const visibleIds = useMemo(() => visible.map((item) => item.id), [visible]);
  // Entries that left the list (removed, cleaned up, filtered out) leave the selection.
  const selection = keepVisible(rawSelection, visibleIds);
  const selected = new Set(selection.ids);

  // Files may have moved since the page was last open.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Dropped files land on top; clear the search and filter and bring them into view.
  useEffect(() => {
    if (!recentDrop) return;
    setQuery("");
    setView("all");
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [recentDrop]);

  return (
    <section className={`island-list-page shelf-page${isDropTarget ? " shelf-page--dropping" : ""}`} aria-label={t.fileShelf.title}>
      <FileShelfHeader
        view={view}
        count={items.length}
        noticeKey={recentDrop?.allExisting ? recentDrop.key : null}
        query={query}
        selectedCount={selection.ids.length}
        onViewChange={setView}
        onQueryChange={setQuery}
        onClear={() => void shelf.clear()}
        onCopySelected={() => void shelf.copy(selection.ids)}
        onRemoveSelected={() => void shelf.remove(selection.ids)}
        onClearSelection={() => setSelection(EMPTY_SELECTION)}
      />
      {error && <p className="shelf-page__error" role="alert">{error}</p>}
      {items.length === 0 ? (
        <div className="island-list-empty">
          <span className="island-list-empty__icon" aria-hidden="true">
            {isDropTarget ? <ArrowDownToLine size={22} strokeWidth={1.9} /> : <Inbox size={22} strokeWidth={1.8} />}
          </span>
          <strong>{isDropTarget ? t.fileShelf.dropHint : t.fileShelf.empty}</strong>
          {!isDropTarget && <small>{t.fileShelf.emptyHint}</small>}
        </div>
      ) : visible.length === 0 ? (
        <div className="island-list-empty"><small>{t.fileShelf.emptySearch}</small></div>
      ) : (
        <div
          ref={listRef}
          className="island-list shelf-list"
          role="list"
          aria-multiselectable="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelection(EMPTY_SELECTION);
          }}
        >
          {visible.map((item) => (
            <FileShelfItemRow
              key={item.id}
              item={item}
              isRecent={recentIds.has(item.id)}
              isSelected={selected.has(item.id)}
              menuOpen={menuItemId === item.id}
              onMenuOpenChange={(open) => setMenuItemId((current) => (open ? item.id : current === item.id ? null : current))}
              onSelect={(id, mode) => setSelection((current) => selectEntry(keepVisible(current, visibleIds), visibleIds, id, mode))}
              onDragOut={(id) => void shelf.startDrag(targetIds(selection, id))}
              onOpen={(id) => void (revealOnDoubleClick ? shelf.reveal(id) : shelf.open(id))}
              onOpenFile={(id) => void shelf.open(id)}
              onCopy={(id) => shelf.copy([id])}
              onReveal={(id) => void shelf.reveal(id)}
              onTogglePin={(id) => void shelf.togglePin(id)}
              onRemove={(id) => void shelf.remove([id])}
            />
          ))}
        </div>
      )}
      {isDropTarget && items.length > 0 && (
        <div className="shelf-drop-overlay" aria-hidden="true">
          <ArrowDownToLine size={22} strokeWidth={2.2} />
          <span>{t.fileShelf.dropHint}</span>
        </div>
      )}
    </section>
  );
}
