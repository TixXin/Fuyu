import { Fragment, type MouseEvent, type RefObject } from "react";
import { startClipboardDrag, type ClipboardHistoryItem, type ClipboardSnippet } from "./api";
import { ClipboardPopupRow } from "./ClipboardPopupRow";

export function ClipboardPopupList({ listRef, label, snippetsLabel, snippets, items, current, now, queue, dayGroups, linkPreview, onHover, onHoverSnippet, onPasteSnippet, onPick, onToggleFavorite, onDelete, onMenu }: {
  listRef: RefObject<HTMLUListElement | null>;
  label: string;
  snippetsLabel: string | null;
  snippets: readonly ClipboardSnippet[] | null;
  items: readonly ClipboardHistoryItem[];
  current: number;
  now: number;
  queue: readonly string[];
  dayGroups: readonly (string | null)[];
  linkPreview: boolean;
  onHover: (index: number) => void;
  onHoverSnippet: (index: number) => void;
  onPasteSnippet: (id: string) => void;
  onPick: (entry: ClipboardHistoryItem, event: MouseEvent) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (entry: ClipboardHistoryItem) => void;
  onMenu: (index: number) => void;
}) {
  return (
    <ul className="clipboard-popup__list" ref={listRef} role="listbox" aria-label={label}>
      {snippetsLabel && <li className="clipboard-popup__section" role="presentation">{snippetsLabel}</li>}
      {snippets
        ? snippets.map((snippet, index) => (
          <ClipboardPopupRow
            key={snippet.id}
            index={index}
            now={now}
            selected={index === current}
            queued={0}
            snippet={snippet}
            onHover={() => onHoverSnippet(index)}
            onPick={() => onPasteSnippet(snippet.id)}
          />
        ))
        : items.map((entry, index) => (
          <Fragment key={entry.id}>
            {dayGroups[index] && <li className="clipboard-popup__section" role="presentation">{dayGroups[index]}</li>}
            <ClipboardPopupRow
              index={index}
              now={now}
              selected={index === current}
              queued={queue.indexOf(entry.id) + 1}
              entry={entry}
              onHover={() => onHover(index)}
              onPick={(event) => onPick(entry, event)}
              onToggleFavorite={() => onToggleFavorite(entry.id)}
              onDelete={() => onDelete(entry)}
              onMenu={() => onMenu(index)}
              linkPreview={linkPreview}
              onDrag={() => void startClipboardDrag(entry.id).catch((error: unknown) => console.error("Failed to drag a clipboard entry", error))}
            />
          </Fragment>
        ))}
    </ul>
  );
}
