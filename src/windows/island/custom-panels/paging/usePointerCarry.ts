import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

const DRAG_START_PX = 5;

export type Carry<T> = { payload: T; clientX: number; clientY: number };

type Handlers<T> = {
  onMove: (carry: Carry<T> | null) => void;
  onDrop: (carry: Carry<T>) => void;
};

export function usePointerCarry<T>({ onMove, onDrop }: Handlers<T>) {
  const latest = useRef({ onMove, onDrop });
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => {
    latest.current = { onMove, onDrop };
  });
  useEffect(() => () => stop.current?.(), []);

  return (payload: T) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stop.current?.();
    const pointer = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    let dragging = false;
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      if (!dragging && Math.hypot(next.clientX - start.x, next.clientY - start.y) < DRAG_START_PX) return;
      dragging = true;
      latest.current.onMove({ payload, clientX: next.clientX, clientY: next.clientY });
    };
    const end = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      stop.current?.();
      latest.current.onMove(null);
      if (dragging && next.type !== "pointercancel") latest.current.onDrop({ payload, clientX: next.clientX, clientY: next.clientY });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    stop.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      stop.current = null;
    };
  };
}
