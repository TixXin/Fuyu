import { Fragment, useLayoutEffect, useMemo, useRef, type MouseEvent, type MutableRefObject, type RefObject } from "react";
import { startClipboardDrag, type ClipboardHistoryItem, type ClipboardSnippet } from "./api";
import { useTranslation } from "../../i18n";
import { ClipboardPopupRow, type PopupRowActions } from "./ClipboardPopupRow";
import { digitSlot } from "./pins";
import { popupSlotOffsets, skippedHeight } from "./popupSlots";
import { usePopupSlotSizes } from "./usePopupSlotSizes";
import type { PinGrip } from "./usePopupPins";
import { useVirtualSlots } from "./useVirtualRows";
import "./ClipboardPins.css";

type ListProps = {
  listRef: RefObject<HTMLUListElement | null>;
  scrollRef: MutableRefObject<((index: number) => void) | null>;
  label: string;
  snippetsLabel: string | null;
  snippets: readonly ClipboardSnippet[] | null;
  items: readonly ClipboardHistoryItem[];
  current: number;
  now: number;
  queue: readonly string[];
  dayGroups: readonly (string | null)[];
  pins: { pinned: number; dragging: number | null; grip: (index: number) => PinGrip | undefined };
  linkPreview: boolean;
  onHover: (index: number) => void;
  onHoverSnippet: (index: number) => void;
  onPasteSnippet: (id: string) => void;
  onPick: (entry: ClipboardHistoryItem, event: MouseEvent) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (entry: ClipboardHistoryItem) => void;
  onMenu: (index: number) => void;
};

function useRowActions(props: ListProps) {
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  return useMemo(() => {
    const entry = (index: number) => latest.current.items[index];
    const items: PopupRowActions = {
      hover: (index) => latest.current.onHover(index),
      pick: (index, event) => entry(index) && latest.current.onPick(entry(index), event),
      favorite: (index) => entry(index) && latest.current.onToggleFavorite(entry(index).id),
      remove: (index) => entry(index) && latest.current.onDelete(entry(index)),
      menu: (index) => latest.current.onMenu(index),
      drag: (index) => {
        const id = entry(index)?.id;
        if (id) void startClipboardDrag(id).catch((error: unknown) => console.error("Failed to drag a clipboard entry", error));
      },
    };
    const snippets: PopupRowActions = {
      hover: (index) => latest.current.onHoverSnippet(index),
      pick: (index) => {
        const snippet = latest.current.snippets?.[index];
        if (snippet) latest.current.onPasteSnippet(snippet.id);
      },
    };
    return { items, snippets };
  }, []);
}

export function ClipboardPopupList(props: ListProps) {
  const { listRef, scrollRef, label, snippetsLabel, snippets, items, current, now, queue, dayGroups, pins, linkPreview } = props;
  const pinnedLabel = useTranslation().clipboardList.pinned;
  const pinned = pins.pinned;
  const heading = (index: number) => (pinned > 0 && index === 0 ? pinnedLabel : index >= pinned ? dayGroups[index - pinned] : null);
  const actions = useRowActions(props);
  const count = snippets ? 0 : items.length;
  const { sizes, inset } = usePopupSlotSizes(listRef, [count, pinned, dayGroups, snippets]);
  const top = Math.min(pinned, count);
  const offsets = useMemo(
    () => popupSlotOffsets(count, pinned, (index) => (pinned > 0 && index === 0) || (index >= pinned && Boolean(dayGroups[index - pinned])), sizes),
    [count, pinned, dayGroups, sizes],
  );
  const slots = useVirtualSlots(listRef, offsets, inset);
  const { scrollToIndex } = slots;
  const plain = snippets !== null;
  useLayoutEffect(() => {
    scrollRef.current = plain
      ? (index) => listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" })
      : scrollToIndex;
  }, [scrollRef, scrollToIndex, plain, listRef]);

  const start = Math.max(slots.start, top);
  const end = Math.max(slots.end, start);
  const before = skippedHeight(offsets, top, start, sizes.gap);
  const after = skippedHeight(offsets, end, count, sizes.gap);

  const row = (entry: ClipboardHistoryItem, index: number) => {
    const selected = index === current;
    const dragging = pins.dragging === index;
    return (
      <ClipboardPopupRow
        index={index}
        now={now}
        selected={selected}
        queued={queue.indexOf(entry.id) + 1}
        entry={entry}
        slot={digitSlot(index, pinned)}
        pinned={index < pinned}
        grip={selected || dragging ? pins.grip(index) : undefined}
        dragging={dragging}
        linkPreview={linkPreview}
        actions={actions.items}
      />
    );
  };

  return (
    <ul className="clipboard-popup__list" ref={listRef} role="listbox" aria-label={label}>
      {snippetsLabel && <li className="clipboard-popup__section" role="presentation">{snippetsLabel}</li>}
      {snippets
        ? snippets.map((snippet, index) => (
          <ClipboardPopupRow key={snippet.id} index={index} now={now} selected={index === current} queued={0} snippet={snippet} actions={actions.snippets} />
        ))
        : (
          <>
            {items.slice(0, top).map((entry, index) => (
              <Fragment key={entry.id}>
                {index === 0 && <li className="clipboard-popup__section" role="presentation">{heading(0)}</li>}
                {row(entry, index)}
              </Fragment>
            ))}
            {before > 0 && <li className="clipboard-popup__spacer" role="presentation" style={{ height: before }} />}
            {items.slice(start, end).map((entry, offset) => {
              const index = start + offset;
              return (
                <Fragment key={entry.id}>
                  {pinned > 0 && index === pinned && <li className="clipboard-popup__divider" role="separator" />}
                  {heading(index) && <li className="clipboard-popup__section" role="presentation">{heading(index)}</li>}
                  {row(entry, index)}
                </Fragment>
              );
            })}
            {after > 0 && <li className="clipboard-popup__spacer" role="presentation" style={{ height: after }} />}
          </>
        )}
    </ul>
  );
}
