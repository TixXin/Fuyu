import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

const HOLD_MS = 300;
const SLOP_PX = 4;
const NOT_A_HANDLE =
  "button:not(.island__open-button, .island__collapse-target), input, textarea, select, a, [contenteditable='true'], [data-window-drag='false']";

export function useWindowDragGesture(isTucked: boolean, onWindowDragStart: () => void) {
  const didDragRef = useRef(false);
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number; pointer: number } | null>(null);
  const latest = useRef(onWindowDragStart);
  useEffect(() => {
    latest.current = onWindowDragStart;
  });

  const cancelWindowDrag = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const from = start.current;
      if (from && event.pointerId === from.pointer && Math.hypot(event.clientX - from.x, event.clientY - from.y) > SLOP_PX) cancelWindowDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", cancelWindowDrag);
    window.addEventListener("pointercancel", cancelWindowDrag);
    window.addEventListener("blur", cancelWindowDrag);
    return () => {
      cancelWindowDrag();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", cancelWindowDrag);
      window.removeEventListener("pointercancel", cancelWindowDrag);
      window.removeEventListener("blur", cancelWindowDrag);
    };
  }, [cancelWindowDrag]);

  const prepareWindowDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      didDragRef.current = false;
      cancelWindowDrag();
      if (event.button !== 0 || isTucked) return;
      if (event.target instanceof Element && event.target.closest(NOT_A_HANDLE)) return;
      start.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        start.current = null;
        didDragRef.current = true;
        latest.current();
      }, HOLD_MS);
    },
    [isTucked, cancelWindowDrag],
  );

  return { didDragRef, prepareWindowDrag, cancelWindowDrag };
}
