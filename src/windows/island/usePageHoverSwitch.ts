import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { createPageHoverGate, pageHoverMoved, pageHoverWait, settlePageHover } from "./pageHoverGate";
import type { IslandPage } from "./types";

type HoverHandlers = { onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerLeave: () => void };

const gate = createPageHoverGate();

export function usePageHoverSwitch(enabled: boolean, delayMs: number, page: IslandPage, onPageChange: (page: IslandPage) => void) {
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<IslandPage | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);
  useEffect(() => {
    cancel();
    settlePageHover(gate, performance.now());
  }, [page, cancel]);

  return useCallback(
    (target: IslandPage): HoverHandlers | Record<string, never> => {
      if (!enabled) return {};
      return {
        onPointerMove: (event) => {
          if (!pageHoverMoved(gate, event.clientX, event.clientY)) return;
          if (pendingRef.current === target) return;
          cancel();
          const button = event.currentTarget;
          pendingRef.current = target;
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            pendingRef.current = null;
            if (button.isConnected && button.matches(":hover")) onPageChangeRef.current(target);
          }, pageHoverWait(gate, delayMs, performance.now()));
        },
        onPointerLeave: cancel,
      };
    },
    [enabled, delayMs, cancel],
  );
}
