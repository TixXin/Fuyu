import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type BoxDragKind = "move" | "stretch";
export type BoxDrag = { widget: string; kind: BoxDragKind; dx: number; dy: number };
export type BoxDrop = BoxDrag & { clientX: number; clientY: number };

const TAP_PX = 4;

type Handlers = {
  scale: number;
  onDrop: (drop: BoxDrop) => void;
  onTap?: (widget: string) => void;
};

export function useBoxDrag({ scale, onDrop, onTap }: Handlers) {
  const [drag, setDrag] = useState<BoxDrag | null>(null);
  const start = useRef<{ widget: string; kind: BoxDragKind; x: number; y: number; pointer: number; moved: boolean } | null>(null);
  const latest = useRef({ scale, onDrop, onTap });
  useEffect(() => {
    latest.current = { scale, onDrop, onTap };
  });

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const from = start.current;
      if (!from || event.pointerId !== from.pointer) return;
      const rawX = event.clientX - from.x;
      const rawY = event.clientY - from.y;
      if (!from.moved && Math.hypot(rawX, rawY) < TAP_PX) return;
      from.moved = true;
      const factor = latest.current.scale || 1;
      setDrag({ widget: from.widget, kind: from.kind, dx: rawX / factor, dy: rawY / factor });
    };
    const end = (event: PointerEvent) => {
      const from = start.current;
      if (!from || event.pointerId !== from.pointer) return;
      start.current = null;
      setDrag(null);
      if (event.type === "pointercancel") return;
      const factor = latest.current.scale || 1;
      if (from.moved) latest.current.onDrop({ widget: from.widget, kind: from.kind, dx: (event.clientX - from.x) / factor, dy: (event.clientY - from.y) / factor, clientX: event.clientX, clientY: event.clientY });
      else if (from.kind === "move") latest.current.onTap?.(from.widget);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const begin = useCallback((widget: string, kind: BoxDragKind) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    start.current = { widget, kind, x: event.clientX, y: event.clientY, pointer: event.pointerId, moved: false };
  }, []);

  const beginAt = useCallback((widget: string, kind: BoxDragKind, point: { clientX: number; clientY: number; pointerId: number }) => {
    start.current = { widget, kind, x: point.clientX, y: point.clientY, pointer: point.pointerId, moved: false };
  }, []);

  return { drag, begin, beginAt };
}

export const snapPx = (value: number, unit: number) => Math.round(value / unit) * unit;
