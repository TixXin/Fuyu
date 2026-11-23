import { useEffect, useRef } from "react";
import { cycleShortcutPage, type IslandFeatures } from "./features";
import { IDLE_SWIPE, swipeStep, wheelPixels } from "./pageSwipe";
import type { IslandPage } from "./types";
import { pulsePageArrow } from "./usePageArrowKeys";

type PageSwipe = {
  enabled: boolean;
  features: IslandFeatures;
  page: IslandPage;
  onPageChange: (page: IslandPage) => void;
};

function swipeTarget(target: EventTarget | null): boolean {
  let element = target instanceof Element ? target : null;
  for (; element && element.id !== "island-panel"; element = element.parentElement) {
    if (element instanceof HTMLElement && element.scrollWidth > element.clientWidth + 1) {
      const overflow = getComputedStyle(element).overflowX;
      if (overflow === "auto" || overflow === "scroll") return false;
    }
  }
  return element !== null;
}

export function usePageSwipe(swipe: PageSwipe) {
  const latest = useRef(swipe);
  useEffect(() => {
    latest.current = swipe;
  });

  useEffect(() => {
    if (!swipe.enabled) return;
    let state = IDLE_SWIPE;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
      if (!swipeTarget(event.target)) {
        state = IDLE_SWIPE;
        return;
      }
      const dx = wheelPixels(event.deltaX, event.deltaMode, window.innerWidth);
      const dy = wheelPixels(event.deltaY, event.deltaMode, window.innerHeight);
      const step = swipeStep(state, dx, dy, event.timeStamp);
      state = step.state;
      if (step.turn === null) return;
      const current = latest.current;
      const next = cycleShortcutPage(current.features, current.page, step.turn);
      if (!next) return;
      current.onPageChange(next);
      pulsePageArrow(step.turn < 0 ? "previous" : "next");
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [swipe.enabled]);
}
