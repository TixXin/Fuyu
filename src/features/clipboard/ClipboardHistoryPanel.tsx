import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import { useTranslation } from "../../i18n";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import type { ClipboardCopyAs, ClipboardHistorySnapshot } from "./api";
import { ClipboardActionPanel } from "./ClipboardActionPanel";
import { ClipboardFilters } from "./ClipboardFilters";
import { ClipboardHistoryItemRow } from "./ClipboardHistoryItemRow";
import { ClipboardLinksPanel } from "./ClipboardLinksPanel";
import { ClipboardPanelHeader } from "./ClipboardPanelHeader";
import { useClipboardConfirmations } from "./useClipboardConfirmations";
import { useClipboardLinks } from "./useClipboardLinks";
import { topTags, useClipboardHistoryList } from "./useClipboardHistoryList";
import { useClipboardNoteEditor } from "./useClipboardNoteEditor";
import "../../components/list/IslandList.css";
import "./ClipboardPopupPanels.css";
import "./ClipboardHistoryPanel.css";
import { openShortcutLabel } from "./shortcut";

type Tools = { id: string; page: "transforms" | "ai" };

const CLOCK_MS = 30_000;

export function ClipboardHistoryPanel({
  snapshot,
  onCopyItem,
  onToggleFavorite,
  onUpdateNote,
  onDeleteItem,
  onClear,
  extraView,
}: {
  snapshot: ClipboardHistorySnapshot;
  onCopyItem: (id: string, copyAs?: ClipboardCopyAs) => Promise<boolean> | boolean;
  onToggleFavorite: (id: string) => Promise<void> | void;
  onUpdateNote: (id: string, note: string) => Promise<boolean> | boolean;
  onDeleteItem: (id: string) => Promise<void> | void;
  onClear: () => Promise<void> | void;
  extraView?: { label: string; content: ReactNode };
}) {
  const t = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [tools, setTools] = useState<Tools | null>(null);
  const [extra, setExtra] = useState<"screenshots" | "links" | null>(null);
  const links = useClipboardLinks();
  const showExtra = extra === "links" || (extra === "screenshots" && extraView !== undefined);
  const { query, setQuery, clipboardView, setClipboardView, favoriteItems, filteredItems, itemElementsRef } = useClipboardHistoryList(snapshot.items);
  const { confirmDeleteId, isConfirmingClear, dismissConfirmations, handleDeleteItem, handleClear } = useClipboardConfirmations(snapshot.items, onDeleteItem, onClear);
  const {
    copiedItemId,
    showCopiedState,
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

  useEffect(() => visibilityInterval(() => setNow(Date.now()), CLOCK_MS), []);

  const showTag = (tag: string) => {
    setExtra(null);
    setClipboardView("all");
    setQuery(query.trim().toLowerCase() === `#${tag.toLowerCase()}` ? "" : `#${tag}`);
  };

  const toolsItem = tools ? snapshot.items.find((item) => item.id === tools.id) : undefined;
  const copyResult = (id: string, value: string) => {
    void navigator.clipboard.writeText(value).then(
      () => showCopiedState(id),
      (error: unknown) => console.error("Failed to copy the result", error),
    );
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
        extras={[
          ...(extraView ? [{ key: "screenshots", label: extraView.label, pressed: showExtra && extra === "screenshots", onSelect: () => setExtra("screenshots") }] : []),
          { key: "links", label: t.clipboard.links.chip, pressed: extra === "links", onSelect: () => setExtra("links") },
        ]}
        onViewChange={(view) => {
          setExtra(null);
          setClipboardView(view);
          if (query.trim().startsWith("#")) setQuery("");
        }}
        onTag={showTag}
        onClear={handleClear}
      />
      {!showExtra && <ClipboardFilters query={query} shortcut={openShortcutLabel(snapshot.settings)} onQueryChange={setQuery} />}

      {extra === "links" ? (
        <ClipboardLinksPanel state={links} icons={snapshot.settings.linkPreview === true} />
      ) : showExtra ? (
        extraView?.content
      ) : empty ? (
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
              onTools={(page) => setTools({ id: item.id, page })}
              bookmarks={links.links.links}
              onBookmark={(url) => void links.add(url)}
            />
          ))}
        </div>
      )}
      {tools && toolsItem && (
        <div className="clipboard-island-tools">
          <ClipboardActionPanel
            key={`${tools.id}-${tools.page}`}
            item={toolsItem}
            actions={[]}
            page={tools.page}
            aiPrompts={snapshot.settings.aiPrompts}
            copy
            onPage={(page) => setTools(page === "transforms" || page === "ai" ? { id: tools.id, page } : null)}
            onClose={() => setTools(null)}
            onPasteText={(value) => copyResult(tools.id, value)}
            onSaveNote={() => {}}
          />
        </div>
      )}
    </section>
  );
}
