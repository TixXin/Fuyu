import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { ClipboardCopyAs, ClipboardHistorySnapshot } from "./api";
import { ClipboardFilters } from "./ClipboardFilters";
import { ClipboardHistoryItemRow } from "./ClipboardHistoryItemRow";
import { ClipboardPanelHeader } from "./ClipboardPanelHeader";
import { useClipboardConfirmations } from "./useClipboardConfirmations";
import { topTags, useClipboardHistoryList } from "./useClipboardHistoryList";
import { useClipboardNoteEditor } from "./useClipboardNoteEditor";
import "../../components/list/IslandList.css";
import "./ClipboardHistoryPanel.css";

// "5 分钟前" moves on while the page stays open.
const CLOCK_MS = 30_000;

export function ClipboardHistoryPanel({
  snapshot,
  onCopyItem,
  onToggleFavorite,
  onUpdateNote,
  onDeleteItem,
  onClear,
}: {
  snapshot: ClipboardHistorySnapshot;
  onCopyItem: (id: string, copyAs?: ClipboardCopyAs) => Promise<boolean> | boolean;
  onToggleFavorite: (id: string) => Promise<void> | void;
  onUpdateNote: (id: string, note: string) => Promise<boolean> | boolean;
  onDeleteItem: (id: string) => Promise<void> | void;
  onClear: () => Promise<void> | void;
}) {
  const t = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const { query, setQuery, clipboardView, setClipboardView, favoriteItems, filteredItems, itemElementsRef } = useClipboardHistoryList(snapshot.items);
  const { confirmDeleteId, isConfirmingClear, dismissConfirmations, handleDeleteItem, handleClear } = useClipboardConfirmations(snapshot.items, onDeleteItem, onClear);
  const {
    copiedItemId,
    editingNoteId,
    noteDraft,
    setNoteDraft,
    isSavingNote,
    handleCopyItem,
    handleToggleFavorite,
    startEditingNote,
    cancelEditingNote,
    saveNote,
  } = useClipboardNoteEditor(snapshot.items, onCopyItem, onToggleFavorite, onUpdateNote, dismissConfirmations);
  const tags = useMemo(() => topTags(snapshot.items), [snapshot.items]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const showTag = (tag: string) => {
    setClipboardView("all");
    setQuery(query.trim().toLowerCase() === `#${tag.toLowerCase()}` ? "" : `#${tag}`);
  };

  const empty = snapshot.items.length === 0;
  return (
    <section className="island-list-page clipboard-page" aria-label={t.clipboard.title}>
      <ClipboardPanelHeader
        view={clipboardView}
        query={query}
        tags={tags}
        itemCount={snapshot.items.length}
        isConfirmingClear={isConfirmingClear}
        onViewChange={(view) => {
          setClipboardView(view);
          if (query.trim().startsWith("#")) setQuery("");
        }}
        onTag={showTag}
        onClear={handleClear}
      />
      <ClipboardFilters query={query} shortcut={snapshot.settings.shortcutEnabled ? snapshot.settings.shortcut : null} onQueryChange={setQuery} />

      {empty ? (
        <div className="island-list-empty">
          <span className="island-list-empty__icon" aria-hidden="true"><ClipboardList size={22} strokeWidth={1.8} /></span>
          <strong>{t.clipboard.emptyAll}</strong>
          <small>{t.clipboard.emptyHint}</small>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="island-list-empty">
          <small>{clipboardView === "favorites" && favoriteItems.length === 0 && !query ? t.clipboard.emptyFavorites : t.clipboard.emptySearch}</small>
        </div>
      ) : (
        <div className="island-list" role="list">
          {filteredItems.map((item) => (
            <ClipboardHistoryItemRow
              key={item.id}
              item={item}
              now={now}
              elementRef={(node) => {
                if (node) itemElementsRef.current.set(item.id, node);
                else itemElementsRef.current.delete(item.id);
              }}
              isEditingNote={editingNoteId === item.id}
              noteDraft={noteDraft}
              isSavingNote={isSavingNote}
              isConfirmingDelete={confirmDeleteId === item.id}
              copied={copiedItemId === item.id ? "original" : copiedItemId?.startsWith(`${item.id}:`) ? (copiedItemId.slice(item.id.length + 1) as ClipboardCopyAs) : null}
              menuOpen={menuItemId === item.id}
              onMenuOpenChange={(open) => setMenuItemId((current) => (open ? item.id : current === item.id ? null : current))}
              onCopy={handleCopyItem}
              onToggleFavorite={handleToggleFavorite}
              onStartEditNote={startEditingNote}
              onNoteDraftChange={setNoteDraft}
              onSaveNote={saveNote}
              onCancelEditNote={cancelEditingNote}
              onDelete={handleDeleteItem}
              onTag={showTag}
            />
          ))}
        </div>
      )}
    </section>
  );
}
