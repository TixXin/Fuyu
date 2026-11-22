import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export type BoxDragKind = "move" | "stretch";
export type BoxDrag = { widget: string; kind: BoxDragKind; dx: number; dy: number; clientX: number; clientY: number };
export type BoxDrop = BoxDrag;

const TAP_PX = 4;

type Handlers = {
  scale: number;
  onDrop: (drop: BoxDrop) => void;
  onTap?: (widget: string) => void;
  scroller?: RefObject<HTMLElement | null>;
};

type Start = { widget: string; kind: BoxDragKind; x: number; y: number; left: number; top: number; pointer: number; moved: boolean; clientX: number; clientY: number };

export function useBoxDrag({ scale, onDrop, onTap, scroller }: Handlers) {
  const [drag, setDrag] = useState<BoxDrag | null>(null);
  const start = useRef<Start | null>(null);
  const latest = useRef({ scale, onDrop, onTap, scroller });
  useEffect(() => {
    latest.current = { scale, onDrop, onTap, scroller };
  });

  const measure = useCallback((from: Start): BoxDrag => {
    const factor = latest.current.scale || 1;
    const area = latest.current.scroller?.current;
    const scrolledX = area ? area.scrollLeft - from.left : 0;
    const scrolledY = area ? area.scrollTop - from.top : 0;
    return { widget: from.widget, kind: from.kind, dx: (from.clientX - from.x + scrolledX) / factor, dy: (from.clientY - from.y + scrolledY) / factor, clientX: from.clientX, clientY: from.clientY };
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const from = start.current;
      if (!from || event.pointerId !== from.pointer) return;
      from.clientX = event.clientX;
      from.clientY = event.clientY;
      if (!from.moved && Math.hypot(event.clientX - from.x, event.clientY - from.y) < TAP_PX) return;
      from.moved = true;
      setDrag(measure(from));
    };
    const scrolled = () => {
      const from = start.current;
      if (from?.moved) setDrag(measure(from));
    };
    const end = (event: PointerEvent) => {
      const from = start.current;
      if (!from || event.pointerId !== from.pointer) return;
      start.current = null;
      setDrag(null);
      if (event.type === "pointercancel") return;
      from.clientX = event.clientX;
      from.clientY = event.clientY;
      if (from.moved) latest.current.onDrop(measure(from));
      else if (from.kind === "move") latest.current.onTap?.(from.widget);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("scroll", scrolled, true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("scroll", scrolled, true);
    };
  }, [measure]);

  const open = useCallback((widget: string, kind: BoxDragKind, x: number, y: number, pointer: number) => {
    const area = latest.current.scroller?.current;
    start.current = { widget, kind, x, y, left: area?.scrollLeft ?? 0, top: area?.scrollTop ?? 0, pointer, moved: false, clientX: x, clientY: y };
  }, []);

  const begin = useCallback((widget: string, kind: BoxDragKind) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    open(widget, kind, event.clientX, event.clientY, event.pointerId);
  }, [open]);

  const beginAt = useCallback((widget: string, kind: BoxDragKind, point: { clientX: number; clientY: number; pointerId: number }) => {
    open(widget, kind, point.clientX, point.clientY, point.pointerId);
  }, [open]);

  const cancel = useCallback(() => {
    start.current = null;
    setDrag(null);
  }, []);

  return { drag, begin, beginAt, cancel };
}

export const snapPx = (value: number, unit: number) => Math.round(value / unit) * unit;
