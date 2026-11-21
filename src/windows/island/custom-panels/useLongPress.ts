import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

const HOLD_MS = 500;
const SLOP_PX = 4;

export type LongPressStart = { clientX: number; clientY: number; pointerId: number; target: Element };

export function useLongPress(onHold: (start: LongPressStart) => void, accepts: (target: Element) => boolean) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number; pointer: number } | null>(null);
  const latest = useRef(onHold);
  useEffect(() => {
    latest.current = onHold;
  });

  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const from = start.current;
      if (from && event.pointerId === from.pointer && Math.hypot(event.clientX - from.x, event.clientY - from.y) > SLOP_PX) cancel();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    return () => {
      cancel();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [cancel]);

  return useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const target = event.target;
      if (event.button !== 0 || !(target instanceof Element) || !accepts(target)) return;
      cancel();
      const held = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId, target };
      start.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        start.current = null;
        latest.current(held);
      }, HOLD_MS);
    },
    [accepts, cancel],
  );
}
