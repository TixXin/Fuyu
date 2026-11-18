import { useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from "react";
import { setClipboardPinOrder, type ClipboardHistoryItem } from "./api";
import { moveIndex } from "./linkRules";
import { itemForPinKey, movedPinOrder, pinKeyFromCode, pinnedLayout } from "./pins";
import type { PopupKeyEvent } from "./useStrayKeys";

type Drag = { from: number; to: number };
type DragGeometry = { top: number; gap: number; dragHeight: number; otherHeights: readonly number[] };

export type PinGrip = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
};

function measurePinGeometry(list: HTMLUListElement | null, from: number): DragGeometry | null {
  const rows = [...(list?.querySelectorAll<HTMLElement>("[data-pinned]") ?? [])];
  if (rows.length === 0) return null;
  const rects = rows.map((row) => ({ index: Number(row.dataset.index), box: row.getBoundingClientRect() }));
  const first = rects[0].box;
  const second = rects[1]?.box;
  const gap = second ? Math.max(0, second.top - first.bottom) : 0;
  const dragged = rects.find((entry) => entry.index === from)?.box ?? first;
  const otherHeights = rects.filter((entry) => entry.index !== from).map((entry) => entry.box.height);
  return { top: first.top, gap, dragHeight: dragged.height, otherHeights };
}

function slotAt(geometry: DragGeometry, y: number, currentTo: number): number {
  let cursor = geometry.top;
  let count = 0;
  for (let i = 0; i < geometry.otherHeights.length; i += 1) {
    if (i === currentTo) cursor += geometry.dragHeight + geometry.gap;
    const height = geometry.otherHeights[i];
    if (y > cursor + height / 2) count += 1;
    cursor += height + geometry.gap;
  }
  return count;
}

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
  const dragRef = useRef<Drag | null>(null);
  const geometryRef = useRef<DragGeometry | null>(null);
  const moveFrameRef = useRef(0);
  const pendingYRef = useRef<number | null>(null);
  const pinned = layout.pinned;
  const shown = useMemo(
    () => (drag ? [...moveIndex(layout.items.slice(0, pinned), drag.from, drag.to), ...layout.items.slice(pinned)] : layout.items),
    [drag, layout, pinned],
  );

  useEffect(() => () => {
    if (moveFrameRef.current !== 0) window.cancelAnimationFrame(moveFrameRef.current);
  }, []);

  const applyMoveY = (y: number) => {
    const current = dragRef.current;
    const geometry = geometryRef.current;
    if (!current || !geometry) return;
    const to = slotAt(geometry, y, current.to);
    if (to === current.to) return;
    const next = { from: current.from, to };
    dragRef.current = next;
    setDrag(next);
  };

  const flushMove = () => {
    if (moveFrameRef.current !== 0) {
      window.cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = 0;
    }
    const y = pendingYRef.current;
    if (y !== null) {
      pendingYRef.current = null;
      applyMoveY(y);
    }
  };

  const save = (from: number, to: number) => {
    const order = movedPinOrder(layout.items.slice(0, pinned), from, to);
    if (!order) return Promise.resolve();
    return setClipboardPinOrder(order).then(() => undefined, (error: unknown) => console.error("Failed to reorder pinned clipboard entries", error));
  };

  const grip = (index: number): PinGrip | undefined => (index < pinned ? {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      flushMove();
      event.currentTarget.setPointerCapture(event.pointerId);
      geometryRef.current = measurePinGeometry(listRef.current, index);
      const started = { from: index, to: index };
      dragRef.current = started;
      setDrag(started);
    },
    onPointerMove: (event) => {
      if (!dragRef.current) return;
      pendingYRef.current = event.clientY;
      if (moveFrameRef.current === 0) {
        moveFrameRef.current = window.requestAnimationFrame(() => {
          moveFrameRef.current = 0;
          const y = pendingYRef.current;
          if (y !== null) {
            pendingYRef.current = null;
            applyMoveY(y);
          }
        });
      }
    },
    onPointerUp: () => {
      flushMove();
      const finished = dragRef.current;
      if (!finished) return;
      dragRef.current = null;
      geometryRef.current = null;
      onSelect(finished.to);
      void save(finished.from, finished.to).finally(() => setDrag(null));
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
