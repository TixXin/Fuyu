import { useMemo, useState, type PointerEvent, type RefObject } from "react";
import { setClipboardPinOrder, type ClipboardHistoryItem } from "./api";
import { moveIndex } from "./linkRules";
import { itemForPinKey, movedPinOrder, pinKeyFromCode, pinnedLayout } from "./pins";
import type { PopupKeyEvent } from "./useStrayKeys";

type Drag = { from: number; to: number };

export type PinGrip = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
};

export function usePopupPins({ items, all, active, enabled, listRef, onPaste, onSelect }: {
  items: readonly ClipboardHistoryItem[];
  all: readonly ClipboardHistoryItem[];
  active: boolean;
  enabled: boolean;
  listRef: RefObject<HTMLUListElement | null>;
  onPaste: (id: string, plain: boolean) => void;
  onSelect: (index: number) => void;
}) {
  const layout = useMemo(() => pinnedLayout(items, enabled && active), [items, enabled, active]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const pinned = layout.pinned;
  const shown = useMemo(
    () => (drag ? [...moveIndex(layout.items.slice(0, pinned), drag.from, drag.to), ...layout.items.slice(pinned)] : layout.items),
    [drag, layout, pinned],
  );

  const save = (from: number, to: number) => {
    const order = movedPinOrder(layout.items.slice(0, pinned), from, to);
    if (!order) return Promise.resolve();
    return setClipboardPinOrder(order).then(() => undefined, (error: unknown) => console.error("Failed to reorder pinned clipboard entries", error));
  };

  const indexAt = (y: number, from: number) => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-pinned]") ?? [])];
    return rows.filter((row) => Number(row.dataset.index) !== from && y > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2).length;
  };

  const grip = (index: number): PinGrip | undefined => (index < pinned ? {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ from: index, to: index });
    },
    onPointerMove: (event) => {
      if (drag) setDrag({ ...drag, to: indexAt(event.clientY, drag.from) });
    },
    onPointerUp: () => {
      if (!drag) return;
      onSelect(drag.to);
      void save(drag.from, drag.to).finally(() => setDrag(null));
    },
  } : undefined);

  const handleKey = (event: PopupKeyEvent, current: number): boolean => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return false;
    const hit = itemForPinKey(all, pinKeyFromCode(event.code));
    if (hit) {
      event.preventDefault();
      onPaste(hit.id, event.shiftKey);
      return true;
    }
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!step || current >= pinned) return false;
    event.preventDefault();
    const to = current + step;
    if (to < 0 || to >= pinned) return true;
    onSelect(to);
    void save(current, to);
    return true;
  };

  return { items: shown, pinned, dragging: drag ? drag.to : null, grip, handleKey };
}
