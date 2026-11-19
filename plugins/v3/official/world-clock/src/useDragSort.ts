import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

type DragState = { id: string; from: number; to: number };

export function useDragSort(ids: readonly string[], onMove: (id: string, to: number) => void) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settled, setSettled] = useState<string[] | null>(null);
  const key = ids.join("|");

  useEffect(() => {
    setSettled(null);
  }, [key]);

  useEffect(() => {
    if (!settled) return;
    const timer = setTimeout(() => setSettled(null), 2000);
    return () => clearTimeout(timer);
  }, [settled]);

  function indexAt(clientY: number): number {
    const rows = listRef.current ? Array.from(listRef.current.querySelectorAll<HTMLElement>("[data-sort-row]")) : [];
    let index = 0;
    for (const row of rows) {
      if (row.dataset.sortRow === drag?.id) continue;
      const rect = row.getBoundingClientRect();
      if (clientY > rect.top + rect.height / 2) index += 1;
    }
    return Math.max(0, Math.min(ids.length - 1, index));
  }

  function handleProps(id: string) {
    const from = ids.indexOf(id);
    return {
      onPointerDown(event: ReactPointerEvent<HTMLElement>) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ id, from, to: from });
      },
      onPointerMove(event: ReactPointerEvent<HTMLElement>) {
        if (!drag || drag.id !== id) return;
        const to = indexAt(event.clientY);
        if (to !== drag.to) setDrag({ ...drag, to });
      },
      onPointerUp(event: ReactPointerEvent<HTMLElement>) {
        if (!drag || drag.id !== id) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (drag.to !== drag.from) {
          setSettled(preview());
          onMove(id, drag.to);
        }
        setDrag(null);
      },
      onPointerCancel() {
        setDrag(null);
      },
      onKeyDown(event: KeyboardEvent<HTMLElement>) {
        if (event.key === "ArrowUp" && from > 0) {
          event.preventDefault();
          onMove(id, from - 1);
        } else if (event.key === "ArrowDown" && from < ids.length - 1) {
          event.preventDefault();
          onMove(id, from + 1);
        }
      },
    };
  }

  function preview(): string[] {
    if (!drag) return settled ?? [...ids];
    const next = ids.filter((id) => id !== drag.id);
    next.splice(drag.to, 0, drag.id);
    return next;
  }

  return { listRef, dragging: drag?.id ?? null, order: preview(), handleProps };
}
