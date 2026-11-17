import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import { useTranslation } from "../../i18n";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import type { ClipboardCopyAs, ClipboardHistoryItem, ClipboardHistorySnapshot } from "./api";
import { ClipboardActionPanel } from "./ClipboardActionPanel";
import { ClipboardFilters } from "./ClipboardFilters";
import { ClipboardHistoryItemRow } from "./ClipboardHistoryItemRow";
import { ClipboardLinksPanel } from "./ClipboardLinksPanel";
import { ClipboardPanelHeader } from "./ClipboardPanelHeader";
import { contentKind } from "./contentKind";
import { useClipboardConfirmations } from "./useClipboardConfirmations";
import { useClipboardLinks } from "./useClipboardLinks";
import { topTags, useClipboardHistoryList } from "./useClipboardHistoryList";
import { useClipboardNoteEditor } from "./useClipboardNoteEditor";
import { useVirtualRows } from "./useVirtualRows";
import "../../components/list/IslandList.css";
import "./ClipboardPopupPanels.css";
import "./ClipboardHistoryPanel.css";
import { openShortcutLabel } from "./shortcut";

type Tools = { id: string; page: "transforms" | "ai" };

type RowHandlers = {
  setElement: (id: string, node: HTMLElement | null) => void;
  setMenuOpen: (id: string, open: boolean) => void;
  copy: (id: string, copyAs?: ClipboardCopyAs) => void;
  toggleFavorite: (id: string) => void;
  startEditNote: (item: ClipboardHistoryItem) => void;
  changeNoteDraft: (value: string) => void;
  saveNote: (id: string) => void;
  cancelEditNote: () => void;
  deleteItem: (id: string) => void;
  selectTag: (tag: string) => void;
  openTools: (id: string, page: "transforms" | "ai") => void;
  bookmark: (url: string) => void;
};

const CLOCK_MS = 30_000;
const ROW_ESTIMATE_PX = 48;

function ClipboardVirtualList({
  items,
  resetKey,
  now,
  editingNoteId,
  noteDraft,
  isSavingNote,
  confirmDeleteId,
  copiedItemId,
  menuItemId,
  bookmarkedUrls,
  actions,
}: {
  items: ClipboardHistoryItem[];
  resetKey: string;
  now: number;
  editingNoteId: string | null;
  noteDraft: string;
  isSavingNote: boolean;
  confirmDeleteId: string | null;
  copiedItemId: string | null;
  menuItemId: string | null;
  bookmarkedUrls: ReadonlySet<string>;
  actions: RowHandlers;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const { start, end, before, after } = useVirtualRows(listRef, items.length, ROW_ESTIMATE_PX);

  useLayoutEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [resetKey]);

  return (
    <div className="island-list" role="list" ref={listRef}>
      {before > 0 && <div role="presentation" style={{ height: before }} />}
      {items.slice(start, end).map((item) => {
        const isEditing = editingNoteId === item.id;
        const kind = contentKind(item);
        const copied =
          copiedItemId === item.id
            ? "original"
            : copiedItemId?.startsWith(`${item.id}:`)
              ? (copiedItemId.slice(item.id.length + 1) as ClipboardCopyAs)
              : null;
        return (
          <ClipboardHistoryItemRow
            key={item.id}
            item={item}
            now={now}
            onElementRef={actions.setElement}
            isEditingNote={isEditing}
            noteDraft={isEditing ? noteDraft : ""}
            isSavingNote={isEditing && isSavingNote}
            isConfirmingDelete={confirmDeleteId === item.id}
            copied={copied}
            menuOpen={menuItemId === item.id}
            isBookmarked={kind?.kind === "link" && bookmarkedUrls.has(kind.url.href)}
            onMenuOpenChange={actions.setMenuOpen}
            onCopy={actions.copy}
            onToggleFavorite={actions.toggleFavorite}
            onStartEditNote={actions.startEditNote}
            onNoteDraftChange={actions.changeNoteDraft}
            onSaveNote={actions.saveNote}
            onCancelEditNote={actions.cancelEditNote}
            onDelete={actions.deleteItem}
            onTag={actions.selectTag}
            onTools={actions.openTools}
            onBookmark={actions.bookmark}
          />
        );
      })}
      {after > 0 && <div role="presentation" style={{ height: after }} />}
    </div>
  );
}

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
  const bookmarkedUrls = useMemo(() => new Set(links.links.links.map((link) => link.url)), [links.links.links]);

  useEffect(() => visibilityInterval(() => setNow(Date.now()), CLOCK_MS), []);

  const showTag = useCallback((tag: string) => {
    setExtra(null);
    setClipboardView("all");
    setQuery((current) => (current.trim().toLowerCase() === `#${tag.toLowerCase()}` ? "" : `#${tag}`));
  }, [setClipboardView, setQuery]);

  const latestRef = useRef({
    itemElementsRef,
    handleCopyItem,
    handleToggleFavorite,
    startEditingNote,
    setNoteDraft,
    saveNote,
    cancelEditingNote,
    handleDeleteItem,
    showTag,
    addLink: links.add,
  });
  useLayoutEffect(() => {
    latestRef.current = {
      itemElementsRef,
      handleCopyItem,
      handleToggleFavorite,
      startEditingNote,
      setNoteDraft,
      saveNote,
      cancelEditingNote,
      handleDeleteItem,
      showTag,
      addLink: links.add,
    };
  });

  const rowActions = useMemo<RowHandlers>(
    () => ({
      setElement: (id, node) => {
        if (node) latestRef.current.itemElementsRef.current.set(id, node);
        else latestRef.current.itemElementsRef.current.delete(id);
      },
      setMenuOpen: (id, open) => setMenuItemId((current) => (open ? id : current === id ? null : current)),
      copy: (id, copyAs) => latestRef.current.handleCopyItem(id, copyAs),
      toggleFavorite: (id) => latestRef.current.handleToggleFavorite(id),
      startEditNote: (item) => latestRef.current.startEditingNote(item),
      changeNoteDraft: (value) => latestRef.current.setNoteDraft(value),
      saveNote: (id) => latestRef.current.saveNote(id),
      cancelEditNote: () => latestRef.current.cancelEditingNote(),
      deleteItem: (id) => latestRef.current.handleDeleteItem(id),
      selectTag: (tag) => latestRef.current.showTag(tag),
      openTools: (id, page) => setTools({ id, page }),
      bookmark: (url) => void latestRef.current.addLink(url),
    }),
    [],
  );

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
        <ClipboardVirtualList
          items={filteredItems}
          resetKey={`${clipboardView}\n${query.trim().toLowerCase()}`}
          now={now}
          editingNoteId={editingNoteId}
          noteDraft={noteDraft}
          isSavingNote={isSavingNote}
          confirmDeleteId={confirmDeleteId}
          copiedItemId={copiedItemId}
          menuItemId={menuItemId}
          bookmarkedUrls={bookmarkedUrls}
          actions={rowActions}
        />
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
