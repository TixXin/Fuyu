import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem, ClipboardSnippet } from "./api";
import { ClipboardPopupPreview } from "./ClipboardPopupPreview";
import { ClipboardPopupRow } from "./ClipboardPopupRow";
import { filterPopupItems, nextPopupFilter, popupFilters, popupTags, type PopupFilter } from "./popupFilters";
import { popupIndexAfterKey, toggleQueued } from "./popupKeys";
import "./ClipboardPopup.css";

// "5 分钟前" moves on while the window stays open.
const CLOCK_MS = 30_000;

/**
 * The clipboard window (C22.2), drawn like the island's clipboard page: a search box, a row of
 * chips (all, starred, images, files, snippets and the most used #tags; Tab and Shift+Tab move
 * along them), the entries newest first, and a footer with the keys. ↑↓ move the selection, Enter
 * or a click pastes it (with Shift, as plain text), 1–9 paste that row, Esc closes. Ctrl+click or
 * Ctrl+Space picks entries for a sequence that Enter starts (C24.7). `wide` adds the picked entry
 * in full on the right. `openCount` changes each time the window is shown, which clears the
 * search, the chip and the picks and goes back to the top.
 */
export function ClipboardPopup({ items, snippets, openCount, wide, onPaste, onPasteSnippet, onPasteSequence, onClose, onToggleFavorite }: {
  items: readonly ClipboardHistoryItem[];
  snippets: readonly ClipboardSnippet[];
  openCount: number;
  wide: boolean;
  onPaste: (id: string, plain: boolean) => void;
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
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    setFilter("all");
    setQuery("");
    setSelected(0);
    setQueue([]);
    setNow(Date.now());
    inputRef.current?.focus();
  }, [openCount]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const tags = useMemo(() => popupTags(items), [items]);
  const filters = popupFilters(tags);
  const onSnippets = filter === "snippets";
  const needle = query.trim().toLowerCase();
  const shownItems = useMemo(() => (onSnippets ? [] : filterPopupItems(items, filter, needle)), [items, filter, needle, onSnippets]);
  const shownSnippets = onSnippets && needle
    ? snippets.filter((snippet) => `${snippet.title}\n${snippet.text}`.toLowerCase().includes(needle))
    : snippets;
  const count = onSnippets ? shownSnippets.length : shownItems.length;
  const current = Math.min(selected, Math.max(0, count - 1));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current, filter]);

  const chooseFilter = (next: PopupFilter) => {
    setFilter(next);
    setSelected(0);
    inputRef.current?.focus();
  };
  const pick = (index: number, plain: boolean) => {
    if (onSnippets) {
      if (shownSnippets[index]) onPasteSnippet(shownSnippets[index].id);
    } else if (shownItems[index]) {
      onPaste(shownItems[index].id, plain);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (queue.length > 0) setQueue([]);
      else onClose();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      chooseFilter(nextPopupFilter(filters, filter, event.shiftKey));
      return;
    }
    if (!onSnippets && event.ctrlKey && event.key === " ") {
      event.preventDefault();
      if (shownItems[current]) setQueue(toggleQueued(queue, shownItems[current].id));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!onSnippets && queue.length > 0) onPasteSequence(queue);
      else pick(current, event.shiftKey);
      return;
    }
    // Digits paste a row only while the search box is empty, so a search can still hold numbers.
    const action = popupIndexAfterKey(event.key, current, count, query === "");
    if (!action) return;
    event.preventDefault();
    if (action.paste) pick(action.index, false);
    else setSelected(action.index);
  };

  const chipLabel = (chip: PopupFilter) =>
    chip.startsWith("#") ? chip
      : chip === "all" ? t.clipboard.all
      : chip === "favorites" ? t.clipboard.favorites
      : chip === "images" ? t.clipboard.images
      : chip === "files" ? t.clipboard.files
      : text.tabs.snippets;
  const empty = needle ? null : onSnippets ? text.noSnippets : text.empty;

  return (
    <section className={`clipboard-popup${wide ? " clipboard-popup--wide" : ""}`} aria-label={text.title} onKeyDown={onKeyDown}>
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
                  onHover={() => setSelected(index)}
                  onPick={() => onPasteSnippet(snippet.id)}
                />
              ))
              : shownItems.map((item, index) => (
                <ClipboardPopupRow
                  key={item.id}
                  index={index}
                  now={now}
                  selected={index === current}
                  queued={queue.indexOf(item.id) + 1}
                  entry={item}
                  onHover={() => setSelected(index)}
                  onPick={(event) => {
                    if (event.ctrlKey) setQueue(toggleQueued(queue, item.id));
                    else onPaste(item.id, event.shiftKey);
                  }}
                  onToggleFavorite={() => onToggleFavorite(item.id)}
                />
              ))}
          </ul>
        )}
        {wide && <ClipboardPopupPreview entry={onSnippets ? undefined : shownItems[current]} snippet={onSnippets ? shownSnippets[current] : undefined} />}
      </div>
      {queue.length > 0 ? (
        <footer className="clipboard-popup__hint clipboard-popup__hint--sequence" role="status">
          <span>{text.sequenceCount(queue.length)} · <kbd><CornerDownLeft size={10} strokeWidth={2.4} /></kbd>{text.sequenceStart}</span>
          <span className="clipboard-popup__hint-end"><kbd>Esc</kbd>{text.cancel}</span>
        </footer>
      ) : (
        <footer className="clipboard-popup__hint">
          <span><kbd><CornerDownLeft size={10} strokeWidth={2.4} /></kbd>{text.paste}</span>
          {!onSnippets && <span><kbd>⇧<CornerDownLeft size={10} strokeWidth={2.4} /></kbd>{text.plain}</span>}
          {!onSnippets && <span><kbd>Ctrl</kbd>{text.pickSequence}</span>}
          <span className="clipboard-popup__hint-end"><kbd>Esc</kbd></span>
        </footer>
      )}
    </section>
  );
}
