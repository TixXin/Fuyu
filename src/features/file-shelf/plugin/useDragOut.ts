import { useEffect, useMemo, useRef, type PointerEvent } from "react";

const DRAG_THRESHOLD_PX = 4;

export function useDragOut(start: (key: string) => void) {
  const pressed = useRef<{ key: string; x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const latest = useRef(start);
  useEffect(() => {
    latest.current = start;
  });
  return useMemo(() => ({
    press: (key: string) => (event: PointerEvent) => {
      event.stopPropagation();
      dragged.current = false;
      pressed.current = event.button === 0 ? { key, x: event.clientX, y: event.clientY } : null;
    },
    move: (event: PointerEvent) => {
      const from = pressed.current;
      if (!from) return;
      if ((event.buttons & 1) === 0) {
        pressed.current = null;
        return;
      }
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) < DRAG_THRESHOLD_PX) return;
      pressed.current = null;
      dragged.current = true;
      latest.current(from.key);
    },
    release: () => {
      pressed.current = null;
    },
    wasDragged: () => dragged.current,
  }), []);
}
