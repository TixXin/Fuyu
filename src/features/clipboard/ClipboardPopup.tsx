import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "../../i18n";
import { startClipboardDrag, type ClipboardAiPrompt, type ClipboardCaptureStatus, type ClipboardCopyAs, type ClipboardHistoryItem, type ClipboardSnippet } from "./api";
import { ClipboardActionPanel, type PanelPage } from "./ClipboardActionPanel";
import { ClipboardEditor } from "./ClipboardEditor";
import { ClipboardPauseBar, ClipboardPopupFooter, pausedNow, type MergeSeparator } from "./ClipboardPopupFooter";
import { ClipboardPopupPreview } from "./ClipboardPopupPreview";
import { ClipboardPopupRow } from "./ClipboardPopupRow";
import { dayGroupStarts } from "./dayGroup";
import { mergedText, popupActions } from "./popupActions";
import { filterPopupItems, nextPopupFilter, popupFilters, popupTags, type PopupFilter } from "./popupFilters";
import { popupIndexAfterKey, toggleQueued } from "./popupKeys";
import { loadPinyin, parsePopupQuery } from "./popupQuery";
import { isPrimaryKey } from "./shortcut";
import { usePopupHandlers } from "./usePopupHandlers";
import { useSpacePeek } from "./useSpacePeek";
import "./ClipboardPopup.css";
import "./ClipboardPopupPanels.css";

const CLOCK_MS = 30_000;

type Mode = "list" | "panel" | "look" | "edit";

export function ClipboardPopup({ items, snippets, openCount, wide, capture, linkPreview = false, aiPrompts, onPaste, onPasteSnippet, onPasteSequence, onClose, onToggleFavorite }: {
  items: readonly ClipboardHistoryItem[];
  snippets: readonly ClipboardSnippet[];
  openCount: number;
  wide: boolean;
  capture?: ClipboardCaptureStatus;
  linkPreview?: boolean;
  aiPrompts?: readonly ClipboardAiPrompt[];
  onPaste: (id: string, plain: boolean, options?: { enter?: boolean; copyAs?: ClipboardCopyAs }) => void;
  onPasteSnippet: (id: string) => void;
  onPasteSequence: (ids: string[]) => void;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
}) {
  const t = useTranslation();
  const text = t.clipboard.popup;
  const [filter, setFilter] = useState<PopupFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [queue, setQueue] = useState<string[]>([]);
  const [separator, setSeparator] = useState<MergeSeparator>("newline");
  const [mode, setMode] = useState<Mode>("list");
  const [panelPage, setPanelPage] = useState<PanelPage>("actions");
  const [now, setNow] = useState(() => Date.now());
  const [pinyinReady, setPinyinReady] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const pointerPickRef = useRef(false);
  const { handlers, notice, deletion, saveNote, saveAsNew, pasteText } = usePopupHandlers({ onPaste, onToggleFavorite, onEdit: () => setMode("edit") });
  const { flush } = deletion;

  useEffect(() => {
    flush();
    setFilter("all");
    setQuery("");
    setSelected(0);
    setQueue([]);
    setMode("list");
    setNow(Date.now());
    inputRef.current?.focus();
  }, [openCount, flush]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    void loadPinyin().then((pinyin) => setPinyinReady(pinyin !== null));
    return () => window.clearInterval(timer);
  }, []);

  const pendingId = deletion.pending?.id;
  const visible = useMemo(() => (pendingId ? items.filter((item) => item.id !== pendingId) : items), [items, pendingId]);
  const tags = useMemo(() => popupTags(visible), [visible]);
  const filters = popupFilters(tags);
  const onSnippets = filter === "snippets";
  const parsed = useMemo(() => parsePopupQuery(query), [query]);
  const needle = query.trim().toLowerCase();
  const shownItems = useMemo(
    () => (onSnippets ? [] : filterPopupItems(visible, filter, parsed, now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, filter, parsed, now, onSnippets, pinyinReady],
  );
  const shownSnippets = onSnippets && needle
    ? snippets.filter((snippet) => `${snippet.title}\n${snippet.text}`.toLowerCase().includes(needle))
    : snippets;
  const count = onSnippets ? shownSnippets.length : shownItems.length;
  const current = Math.min(selected, Math.max(0, count - 1));
  const groupStarts = useMemo(() => (wide && !onSnippets ? dayGroupStarts(shownItems.map((entry) => entry.copiedAt), now) : []), [wide, onSnippets, shownItems, now]);
  const item = onSnippets ? undefined : shownItems[current];
  const isText = item?.kind === "text";
  const actions = useMemo(() => popupActions(item, capture, handlers, text.actions), [item, capture, handlers, text.actions]);

  useEffect(() => {
    if (pointerPickRef.current) {
      pointerPickRef.current = false;
      return;
    }
    listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
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
    setSelected(0);
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
  const peek = useSpacePeek(() => setMode((current) => (current === "look" ? "list" : current)));
  const { cancel: cancelPeek } = peek;
  useEffect(() => {
    if (mode !== "look") cancelPeek();
  }, [mode, cancelPeek]);

  const toggleRecord = () => (pausedNow(capture, now) ? handlers.resume() : handlers.pause(null));

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key;
    const ctrl = isPrimaryKey(event) && !event.altKey;
    if (mode === "look") {
      if (key === " " && event.repeat) {
        event.preventDefault();
        return;
      }
      if (key === "Escape" || key === " ") {
        event.preventDefault();
        setMode("list");
        return;
      }
    } else if (mode !== "list") {
      return;
    }
    const handled = () => event.preventDefault();
    if (key === "Escape") {
      handled();
      if (queue.length > 0) setQueue([]);
      else onClose();
    } else if (key === "Tab") {
      handled();
      chooseFilter(nextPopupFilter(filters, filter, event.shiftKey));
    } else if (ctrl && /^[1-9]$/.test(key)) {
      handled();
      const index = Number(key) - 1;
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
    } else if (ctrl && key.toLowerCase() === "z" && deletion.pending) {
      handled();
      deletion.undo();
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
    } else if (key === "Delete" && query === "" && item) {
      handled();
      deletion.remove(item);
    } else {
      const action = popupIndexAfterKey(key, current, count, query === "");
      if (!action) return;
      handled();
      if (action.paste) pick(action.index, false);
      else setSelected(action.index);
    }
  };

  const chipLabel = (chip: PopupFilter) =>
    chip.startsWith("#") ? chip
      : chip === "all" ? t.clipboard.all
      : chip === "favorites" ? t.clipboard.favorites
      : chip === "images" ? t.clipboard.images
      : chip === "files" ? t.clipboard.files
      : chip === "links" ? text.actions.kinds.link
      : chip === "colors" ? text.actions.kinds.color
      : text.tabs.snippets;
  const empty = needle ? null : onSnippets ? text.noSnippets : text.empty;
  const editing = mode === "edit" && item && isText;

  return (
    <section className={`clipboard-popup${wide ? " clipboard-popup--wide" : ""}`} aria-label={text.title} onKeyDown={onKeyDown} onKeyUp={peek.keyUp}>
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
              setSelected(0);
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
          <ul className="clipboard-popup__list" ref={listRef} role="listbox" aria-label={chipLabel(filter)}>
            {onSnippets && <li className="clipboard-popup__section" role="presentation">{text.snippetsLabel}</li>}
            {onSnippets
              ? shownSnippets.map((snippet, index) => (
                <ClipboardPopupRow
                  key={snippet.id}
                  index={index}
                  now={now}
                  selected={index === current}
                  queued={0}
                  snippet={snippet}
                  onHover={() => selectByPointer(index)}
                  onPick={() => onPasteSnippet(snippet.id)}
                />
              ))
              : shownItems.map((entry, index) => (
                <Fragment key={entry.id}>
                {wide && groupStarts[index] && <li className="clipboard-popup__section" role="presentation">{text.dayGroups[groupStarts[index]]}</li>}
                <ClipboardPopupRow
                  index={index}
                  now={now}
                  selected={index === current}
                  queued={queue.indexOf(entry.id) + 1}
                  entry={entry}
                  onHover={() => mode === "list" && selectByPointer(index)}
                  onPick={(event) => {
                    if (isPrimaryKey(event)) setQueue(toggleQueued(queue, entry.id));
                    else onPaste(entry.id, event.shiftKey);
                  }}
                  onToggleFavorite={() => onToggleFavorite(entry.id)}
                  onMenu={() => {
                    setSelected(index);
                    openPanel("actions");
                  }}
                  linkPreview={linkPreview}
                  onDrag={() => void startClipboardDrag(entry.id).catch((error: unknown) => console.error("Failed to drag a clipboard entry", error))}
                />
                </Fragment>
              ))}
          </ul>
        )}
        {wide && (editing ? (
          <ClipboardEditor key={item.id} item={item} overlay={false} onPasteOnce={(value) => pasteText(value)} onSaveAsNew={(value) => { saveAsNew(value); backToList(); }} onCancel={backToList} />
        ) : (
          <ClipboardPopupPreview entry={item} snippet={onSnippets ? shownSnippets[current] : undefined} linkPreview={linkPreview} onPasteText={pasteText} />
        ))}
        {!wide && editing && (
          <ClipboardEditor key={item.id} item={item} overlay onPasteOnce={(value) => pasteText(value)} onSaveAsNew={(value) => { saveAsNew(value); backToList(); }} onCancel={backToList} />
        )}
        {mode === "look" && item && (
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
        deleted={deletion.pending ? (deletion.pending.kind === "image" ? t.clipboard.imageLabel(deletion.pending.image?.width ?? 0, deletion.pending.image?.height ?? 0) : [...deletion.pending.preview].slice(0, 16).join("")) : null}
        onUndo={deletion.undo}
        notice={notice}
        capture={capture}
        now={now}
        onToggleRecord={toggleRecord}
      />
    </section>
  );
}
