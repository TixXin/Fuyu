import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import {
  blockSlidPage,
  createPageHoverGate,
  leavePageHover,
  pageHoverBlocked,
  pageHoverMoved,
  pageHoverRestarts,
  pageHoverWait,
  PAGE_SWITCH_SETTLE_MS,
  settlePageHover,
} from "./pageHoverGate";
import type { IslandPage } from "./types";

const HOVER_PAGE = "data-hover-page";

type HoverHandlers = {
  [HOVER_PAGE]: string;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
};

const gate = createPageHoverGate();

function buttonSpots() {
  const spots = new Map<string, number>();
  for (const button of document.querySelectorAll<HTMLElement>(`[${HOVER_PAGE}]`)) {
    const page = button.getAttribute(HOVER_PAGE);
    if (page) spots.set(page, button.getBoundingClientRect().left);
  }
  return spots;
}

function hoveredButton() {
  const button = document.querySelector<HTMLElement>(`[${HOVER_PAGE}]:hover`);
  const page = button?.getAttribute(HOVER_PAGE);
  return button && page ? { page, left: button.getBoundingClientRect().left } : null;
}

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
    settlePageHover(gate, performance.now(), buttonSpots());
    const settled = window.setTimeout(() => blockSlidPage(gate, hoveredButton(), page), PAGE_SWITCH_SETTLE_MS);
    return () => window.clearTimeout(settled);
  }, [page, enabled, cancel]);

  return useCallback(
    (target: IslandPage): HoverHandlers | Record<string, never> => {
      if (!enabled) return {};
      return {
        [HOVER_PAGE]: target,
        onPointerMove: (event) => {
          if (pageHoverBlocked(gate, target)) return;
          if (!pageHoverMoved(gate, event.screenX, event.screenY)) return;
          if (!pageHoverRestarts(gate, event.screenX, event.screenY) && pendingRef.current === target) return;
          cancel();
          const button = event.currentTarget;
          pendingRef.current = target;
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            pendingRef.current = null;
            if (button.isConnected && button.matches(":hover") && !pageHoverBlocked(gate, target)) onPageChangeRef.current(target);
          }, pageHoverWait(gate, delayMs, performance.now()));
        },
        onPointerLeave: () => {
          cancel();
          leavePageHover(gate, target);
        },
      };
    },
    [enabled, delayMs, cancel],
  );
}
