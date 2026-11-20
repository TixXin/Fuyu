import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

type Drag = { id: string; over: string | null; after: boolean };

const DRAG_START_PX = 4;
const KEYS: Record<string, -1 | 1> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

export function useChipReorder(ids: readonly string[], onMove: (id: string, before: string | null) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const press = useRef<{ id: string; x: number; y: number } | null>(null);
  const moved = useRef(false);

  const finish = () => {
    const current = drag;
    press.current = null;
    setDrag(null);
    if (!current?.over || current.over === current.id) return;
    const rest = ids.filter((id) => id !== current.id);
    const at = rest.indexOf(current.over);
    if (at < 0) return;
    onMove(current.id, current.after ? (rest[at + 1] ?? null) : current.over);
  };

  const bind = (id: string) => ({
    "data-chip": id,
    "data-dragging": drag?.id === id || undefined,
    "data-drop": drag && drag.id !== id && drag.over === id ? (drag.after ? "after" : "before") : undefined,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || (event.target as HTMLElement).closest("button, input")) return;
      press.current = { id, x: event.clientX, y: event.clientY };
      moved.current = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const start = press.current;
      if (!start) return;
      if (!moved.current && Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_START_PX) return;
      moved.current = true;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-chip]");
      const over = target && ids.includes(target.dataset.chip ?? "") ? (target.dataset.chip ?? null) : null;
      const box = target?.getBoundingClientRect();
      setDrag({ id: start.id, over, after: box ? event.clientX > box.left + box.width / 2 : false });
    },
    onPointerUp: finish,
    onPointerCancel: () => {
      press.current = null;
      setDrag(null);
    },
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (!moved.current) return;
      moved.current = false;
      event.stopPropagation();
      event.preventDefault();
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const step = KEYS[event.key];
      if (!event.altKey || !step || event.target !== event.currentTarget) return;
      event.preventDefault();
      const target = ids.indexOf(id) + step;
      if (target < 0 || target >= ids.length) return;
      onMove(id, step < 0 ? ids[target] : (ids[target + 1] ?? null));
    },
  });

  return { bind, dragging: drag !== null };
}
