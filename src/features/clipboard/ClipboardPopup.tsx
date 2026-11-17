import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { type ClipboardAiPrompt, type ClipboardCaptureStatus, type ClipboardCopyAs, type ClipboardHistoryItem, type ClipboardPeek, type ClipboardSnippet } from "./api";
import { ClipboardActionPanel, type PanelPage } from "./ClipboardActionPanel";
import { ClipboardEditor } from "./ClipboardEditor";
import { ClipboardPauseBar, ClipboardPopupFooter, pausedNow, type MergeSeparator } from "./ClipboardPopupFooter";
import { ClipboardPopupPreview } from "./ClipboardPopupPreview";
import { ClipboardPopupList } from "./ClipboardPopupList";
import { dayGroupStarts } from "./dayGroup";
import { getClipboardActions, subscribeClipboardActions } from "./host/actions.mjs";
import { deletedLabel, withoutPending } from "./pendingItems";
import { withListActions } from "./listActions";
import { recentItems, type RecentRange } from "./recentRange";
import { mergedText, popupActions, withPluginClipboardActions } from "./popupActions";
import { popupFilterLabel } from "./popupFilterLabel";
import { filterPopupItems, nextPopupFilter, popupFilters, popupTags, type PopupFilter } from "./popupFilters";
import { popupIndexAfterKey, toggleQueued } from "./popupKeys";
import { loadPinyin, parsePopupQuery } from "./popupQuery";
import { isPrimaryKey } from "../../lib/shortcut/shortcut";
import { usePopupHandlers } from "./usePopupHandlers";
import { usePopupPins } from "./usePopupPins";
import { useSpacePeek } from "./useSpacePeek";
import { useStrayKeys, type PopupKeyEvent } from "./useStrayKeys";
import "./ClipboardPopup.css";
import "./ClipboardPopupPanels.css";

const CLOCK_MS = 30_000;

type Mode = "list" | "panel" | "look" | "edit";

export function ClipboardPopup({ items, snippets, openCount, wide, ownsWindow = false, capture, linkPreview = false, pinFavorites = false, aiPrompts, onPaste, onPasteSnippet, onPasteSequence, onClose, onToggleFavorite, onPeek }: {
  items: readonly ClipboardHistoryItem[];
  snippets: readonly ClipboardSnippet[];
  openCount: number;
  wide: boolean;
  ownsWindow?: boolean;
  capture?: ClipboardCaptureStatus;
  linkPreview?: boolean;
  pinFavorites?: boolean;
  aiPrompts?: readonly ClipboardAiPrompt[];
  onPaste: (id: string, plain: boolean, options?: { enter?: boolean; copyAs?: ClipboardCopyAs }) => void;
  onPasteSnippet: (id: string) => void;
  onPasteSequence: (ids: string[]) => void;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onPeek?: (peek: ClipboardPeek | null) => void;
}) {
  const t = useTranslation();
  const locale = useLocale().locale === "en" ? "en" : "zh";
  const text = t.clipboard.popup;
  const [filter, setFilter] = useState<PopupFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(-1);
  const [queue, setQueue] = useState<string[]>([]);
  const [separator, setSeparator] = useState<MergeSeparator>("newline");
  const [mode, setMode] = useState<Mode>("list");
  const [panelPage, setPanelPage] = useState<PanelPage>("actions");
  const [now, setNow] = useState(() => Date.now());
  const [pinyinReady, setPinyinReady] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const scrollRef = useRef<((index: number) => void) | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const pointerPickRef = useRef(false);
  const { handlers, notice, deletion, edits, saveNote, saveAsNew, pasteText, setPinKey } = usePopupHandlers({ onPaste, onToggleFavorite, onEdit: () => setMode("edit") });
  const { flush } = deletion;

  useEffect(() => {
    flush();
    setFilter("all");
    setQuery("");
    setSelected(-1);
    setQueue((current) => (current.length === 0 ? current : []));
    setMode("list");
    setNow(Date.now());
    inputRef.current?.focus();
  }, [openCount, flush]);

  useEffect(() => {
    let timer: number | undefined;
    const sync = () => {
      window.clearInterval(timer);
      timer = document.visibilityState === "hidden" ? undefined : window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => {
    void loadPinyin().then((pinyin) => setPinyinReady(pinyin !== null));
  }, []);

  const pending = deletion.pending;
  const visible = useMemo(() => withoutPending(items, pending), [items, pending]);
  const tags = useMemo(() => popupTags(visible), [visible]);
  const filters = popupFilters(tags);
  const onSnippets = filter === "snippets";
  const parsed = useMemo(() => parsePopupQuery(query), [query]);
  const needle = query.trim().toLowerCase();
  const filteredItems = useMemo(
    () => (onSnippets ? [] : filterPopupItems(visible, filter, parsed)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, filter, parsed, onSnippets, pinyinReady],
  );
  const pins = usePopupPins({ items: filteredItems, all: visible, active: filter === "all" && query === "", enabled: pinFavorites, listRef, onPaste: (id, plain) => onPaste(id, plain), onSelect: setSelected });
  const shownItems = pins.items;
  const shownSnippets = onSnippets && needle
    ? snippets.filter((snippet) => `${snippet.title}\n${snippet.text}`.toLowerCase().includes(needle))
    : snippets;
  const count = onSnippets ? shownSnippets.length : shownItems.length;
  const current = Math.min(selected < 0 ? pins.pinned : selected, Math.max(0, count - 1));
  const dayGroupLabels = text.dayGroups;
  const dayGroups = useMemo(() => (wide && !onSnippets ? dayGroupStarts(shownItems.slice(pins.pinned).map((entry) => entry.copiedAt), now).map((start) => (start ? dayGroupLabels[start] : null)) : []), [wide, onSnippets, shownItems, pins.pinned, now, dayGroupLabels]);
  const item = onSnippets ? undefined : shownItems[current];
  const isText = item?.kind === "text";
  const { removeMany } = deletion;
  const recent = useMemo(() => ({ count: (range: RecentRange) => recentItems(visible, range, now).length, remove: (range: RecentRange) => removeMany(recentItems(visible, range, Date.now())) }), [visible, now, removeMany]);
  const pluginActions = useSyncExternalStore(subscribeClipboardActions, getClipboardActions);
  const actions = useMemo(
    () => withPluginClipboardActions(withListActions(popupActions(item, capture, handlers, text.actions), item, t.clipboardList, recent), item, locale, { pasteText }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, capture, handlers, text.actions, t.clipboardList, recent, locale, pasteText, pluginActions],
  );

  useEffect(() => {
    if (pointerPickRef.current) {
      pointerPickRef.current = false;
      return;
    }
    scrollRef.current?.(current);
  }, [current, filter]);

  const selectByPointer = (index: number) => {
    pointerPickRef.current = true;
    setSelected(index);
  };

  const focusSearch = () => window.setTimeout(() => inputRef.current?.focus(), 0);
  const backToList = () => {
    setMode("list");
    focusSearch();
  };
  const openPanel = (page: PanelPage) => {
    setPanelPage(page);
    setMode("panel");
  };
  const chooseFilter = (next: PopupFilter) => {
    setFilter(next);
    setSelected(-1);
    inputRef.current?.focus();
  };
  const pick = (index: number, plain: boolean, enter = false) => {
    if (onSnippets) {
      if (shownSnippets[index]) onPasteSnippet(shownSnippets[index].id);
    } else if (shownItems[index]) {
      onPaste(shownItems[index].id, plain, enter ? { enter } : undefined);
    }
  };
  const pasteMerged = () => {
    const picked = queue.map((id) => items.find((entry) => entry.id === id)).filter((entry): entry is ClipboardHistoryItem => Boolean(entry));
    const merged = mergedText(picked, separator);
    if (merged) pasteText(merged);
  };
  const peek = useSpacePeek(() => setMode((current) => (current === "look" ? "list" : current)), Boolean(onPeek), edits.mark);
  const { cancel: cancelPeek } = peek;
  useEffect(() => {
    if (mode !== "look") cancelPeek();
  }, [mode, cancelPeek]);

  const peekItem = mode === "look" ? item : undefined;
  const { holding: peekHolding, visited: peekStay } = peek;
  useEffect(() => {
    if (!onPeek) return;
    if (!peekItem) {
      onPeek(null);
      return;
    }
    const prefetch = [shownItems[current - 1], shownItems[current + 1]].filter((entry) => entry?.kind === "image" || (entry?.kind === "files" && entry.files?.length === 1 && Boolean(entry.fileImage))).map((entry) => entry.id);
    onPeek({ item: peekItem, holding: peekHolding, prefetch, stay: peekStay });
  }, [onPeek, peekItem, peekHolding, peekStay, shownItems, current]);

  const toggleRecord = () => (pausedNow(capture, now) ? handlers.resume() : handlers.pause(null));

  const onKeyDown = (event: PopupKeyEvent) => {
    const key = event.key;
    const ctrl = isPrimaryKey(event) && !event.altKey;
    if (mode === "look") {
      if (peek.lookKey(event)) return event.preventDefault();
    } else if (mode !== "list") {
      return;
    }
    const handled = () => event.preventDefault();
    if (pins.handleKey(event, current)) return;
    if (key === "Escape") {
      handled();
      if (queue.length > 0) setQueue([]);
      else onClose();
    } else if (key === "Tab") {
      handled();
      chooseFilter(nextPopupFilter(filters, filter, event.shiftKey));
    } else if (ctrl && /^[1-9]$/.test(key)) {
      handled();
      const index = pins.pinned + Number(key) - 1;
      if (index >= count) return;
      setSelected(index);
      if (!wide && !onSnippets) setMode("look");
    } else if (ctrl && key.toLowerCase() === "k") {
      handled();
      openPanel("actions");
    } else if (ctrl && key.toLowerCase() === "t" && isText) {
      handled();
      openPanel("transforms");
    } else if (ctrl && key.toLowerCase() === "i" && isText && !item.masked) {
      handled();
      openPanel("ai");
    } else if (ctrl && key.toLowerCase() === "m" && item) {
      handled();
      openPanel("note");
    } else if (ctrl && key.toLowerCase() === "e" && isText) {
      handled();
      setMode("edit");
    } else if (ctrl && key.toLowerCase() === "s" && item) {
      handled();
      onToggleFavorite(item.id);
    } else if (ctrl && key.toLowerCase() === "z" && (deletion.pending || edits.pending)) {
      handled();
      if (deletion.pending) deletion.undo();
      else edits.undo();
    } else if (ctrl && key === " " && item) {
      handled();
      setQueue(toggleQueued(queue, item.id));
    } else if (key === "Enter") {
      handled();
      if (!onSnippets && queue.length > 0) {
        if (ctrl) pasteMerged();
        else onPasteSequence(queue);
      } else pick(current, event.shiftKey, ctrl);
    } else if (key === " " && query === "" && !wide && item && mode === "list") {
      handled();
      if (event.repeat) return;
      setMode("look");
      peek.start();
    } else if ((key === "ArrowLeft" || key === "ArrowRight") && query === "" && !ctrl && !event.altKey) {
      handled();
      chooseFilter(nextPopupFilter(filters, filter, key === "ArrowLeft"));
    } else if (key === "Delete" && query === "" && item) {
      handled();
      deletion.remove(item);
    } else {
      const action = popupIndexAfterKey(key, current, count, query === "", pins.pinned);
      if (!action) return;
      handled();
      if (action.paste) pick(action.index, false);
      else setSelected(action.index);
    }
  };

  useStrayKeys({ enabled: ownsWindow, root: rootRef, input: inputRef, active: mode === "list", onKeyDown, onKeyUp: peek.keyUp });

  const chipLabel = (chip: PopupFilter) => popupFilterLabel(chip, t.clipboard);
  const empty = needle ? null : onSnippets ? text.noSnippets : text.empty;
  const editing = mode === "edit" && item && isText;
  const editorActions = {
    onPasteOnce: (value: string) => pasteText(value),
    onSaveInPlace: (value: string) => { if (item) edits.save(item.id, value); backToList(); },
    onSaveAsNew: (value: string) => { saveAsNew(value); backToList(); },
    onCancel: backToList,
  };

  return (
    <section ref={rootRef} className={`clipboard-popup${wide ? " clipboard-popup--wide" : ""}`} aria-label={text.title} onKeyDown={onKeyDown} onKeyUp={peek.keyUp}>
      <div className="clipboard-popup__top">
        <label className="clipboard-popup__search">
          <Search size={15} strokeWidth={2} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            placeholder={text.search}
            aria-label={text.search}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setSelected(-1);
            }}
          />
        </label>
        <div className="clipboard-popup__chips" role="tablist" aria-label={text.filters}>
          {filters.map((chip) => (
            <button
              key={chip}
              type="button"
              role="tab"
              tabIndex={-1}
              aria-selected={filter === chip}
              className={`clipboard-popup__chip${chip.startsWith("#") ? " clipboard-popup__chip--tag" : ""}`}
              onClick={() => chooseFilter(chip)}
            >
              {chipLabel(chip)}
            </button>
          ))}
          <kbd className="clipboard-popup__tab-key" aria-hidden="true">Tab</kbd>
        </div>
      </div>
      <ClipboardPauseBar capture={capture} now={now} onResume={handlers.resume} />
      <div className="clipboard-popup__body">
        {count === 0 ? (
          <div className="clipboard-popup__empty" role="status">
            {empty ?? (
              <>
                <strong>{text.noMatch(query.trim())}</strong>
                <span>{text.noMatchHint}</span>
              </>
            )}
          </div>
        ) : (
          <ClipboardPopupList
            listRef={listRef}
            scrollRef={scrollRef}
            label={chipLabel(filter)}
            snippetsLabel={onSnippets ? text.snippetsLabel : null}
            snippets={onSnippets ? shownSnippets : null}
            items={shownItems}
            current={current}
            now={now}
            queue={queue}
            dayGroups={dayGroups}
            pins={pins}
            linkPreview={linkPreview}
            onHover={(index) => mode === "list" && selectByPointer(index)}
            onHoverSnippet={selectByPointer}
            onPasteSnippet={onPasteSnippet}
            onPick={(entry, event) => {
              if (isPrimaryKey(event)) setQueue(toggleQueued(queue, entry.id));
              else onPaste(entry.id, event.shiftKey);
            }}
            onToggleFavorite={onToggleFavorite}
            onDelete={deletion.remove}
            onMenu={(index) => {
              setSelected(index);
              openPanel("actions");
            }}
          />
        )}
        {wide && (editing ? (
          <ClipboardEditor key={item.id} item={item} overlay={false} {...editorActions} />
        ) : (
          <ClipboardPopupPreview entry={item} snippet={onSnippets ? shownSnippets[current] : undefined} linkPreview={linkPreview} onPasteText={pasteText} />
        ))}
        {!wide && editing && (
          <ClipboardEditor key={item.id} item={item} overlay {...editorActions} />
        )}
        {mode === "look" && item && !onPeek && (
          <div className="clipboard-look" role="dialog" aria-label={text.preview.label}>
            <span className="clipboard-look__close"><kbd>{text.actions.spaceKey}</kbd>{peek.holding ? text.actions.releaseToClose : text.actions.closePreview}</span>
            <ClipboardPopupPreview entry={item} linkPreview={linkPreview} onPasteText={pasteText} />
          </div>
        )}
        {mode === "panel" && (
          <ClipboardActionPanel
            key={`${item?.id ?? ""}-${panelPage}`}
            item={item}
            actions={actions}
            page={panelPage}
            onPage={setPanelPage}
            onClose={backToList}
            onPasteText={pasteText}
            onSaveNote={saveNote}
            items={visible}
            onSetPinKey={setPinKey}
            aiPrompts={aiPrompts}
          />
        )}
      </div>
      <ClipboardPopupFooter
        onSnippets={onSnippets}
        wide={wide}
        queued={onSnippets ? 0 : queue.length}
        separator={separator}
        onSeparator={setSeparator}
        deleted={deletion.pending ? deletedLabel(deletion.pending, t.clipboard) : null}
        edited={edits.pending !== null}
        onUndo={deletion.pending ? deletion.undo : edits.undo}
        notice={notice}
        capture={capture}
        now={now}
        onToggleRecord={toggleRecord}
      />
    </section>
  );
}
