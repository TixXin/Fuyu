import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { createPageHoverGate, pageHoverMoved, pageHoverWait, settlePageHover } from "./pageHoverGate";
import type { IslandPage } from "./types";

type HoverHandlers = { onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerLeave: () => void };

// One for the header's buttons and the plugin page buttons together: the pointer is the same.
const gate = createPageHoverGate();

/**
 * Pointer handlers for the expanded island's page buttons that open a page once the
 * pointer rests on its button (Settings → General → Opening → Switch pages on hover).
 * `delayMs` is how long the pointer must rest there, at least a short intent so a pointer
 * passing over buttons does not open each one (pageHoverGate.ts). Only a pointer that really
 * moves onto a button counts; while the island resizes after `page` changed, the switch waits
 * and then happens only if the pointer is still on that button. Returns an empty object for
 * every page while the setting is off.
 */
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
  // Any page change (hover, click, shortcut) moves the buttons while the island resizes.
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
          // Moving on within the same button does not start the wait again.
          if (pendingRef.current === target) return;
          cancel();
          const button = event.currentTarget;
          pendingRef.current = target;
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            pendingRef.current = null;
            // The buttons may have slid while it waited: only the button still under the pointer opens.
            if (button.isConnected && button.matches(":hover")) onPageChangeRef.current(target);
          }, pageHoverWait(gate, delayMs, performance.now()));
        },
        onPointerLeave: cancel,
      };
    },
    [enabled, delayMs, cancel],
  );
}
