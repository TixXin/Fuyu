import { useEffect, useRef } from "react";
import { IDLE_SWIPE, swipeStep, wheelPixels } from "../island/pageSwipe";
import { pulsePageArrow } from "../island/usePageArrowKeys";

type SideDockSwipeOptions = {
  enabled: boolean;
  canStep: boolean;
  onStep: (direction: 1 | -1) => void;
};

const SHIFT_WHEEL_COOLDOWN_MS = 260;

function isInsideDrawerWithoutHorizontalScroll(target: EventTarget | null): boolean {
  let element = target instanceof Element ? target : null;
  let insideDrawer = false;
  for (; element; element = element.parentElement) {
    if (element.classList.contains("side-dock-drawer")) {
      insideDrawer = true;
      break;
    }
    if (element instanceof HTMLElement && element.scrollWidth > element.clientWidth + 1) {
      const overflow = getComputedStyle(element).overflowX;
      if (overflow === "auto" || overflow === "scroll") return false;
    }
  }
  return insideDrawer;
}

function isInsideNonScrollingStrip(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  const strip = element?.closest<HTMLElement>(".side-dock-strip");
  if (!strip) return false;
  return strip.scrollHeight <= strip.clientHeight + 1;
}

export function useSideDockSwipe(options: SideDockSwipeOptions) {
  const latestRef = useRef(options);
  latestRef.current = options;

  useEffect(() => {
    if (!options.enabled) return;
    let state = IDLE_SWIPE;
    let lastWheelStepAt = 0;

    const trigger = (turn: 1 | -1) => {
      latestRef.current.onStep(turn);
      pulsePageArrow(turn < 0 ? "previous" : "next");
    };

    const onWheel = (event: WheelEvent) => {
      if (!latestRef.current.canStep || event.ctrlKey || event.metaKey || event.altKey) return;

      if (isInsideNonScrollingStrip(event.target)) {
        const dy = wheelPixels(event.deltaY, event.deltaMode, window.innerHeight);
        if (Math.abs(dy) >= 16 && event.timeStamp - lastWheelStepAt >= SHIFT_WHEEL_COOLDOWN_MS) {
          lastWheelStepAt = event.timeStamp;
          trigger(dy > 0 ? 1 : -1);
        }
        return;
      }

      if (event.shiftKey && isInsideDrawerWithoutHorizontalScroll(event.target)) {
        const dy = wheelPixels(event.deltaY, event.deltaMode, window.innerHeight);
        const dx = wheelPixels(event.deltaX, event.deltaMode, window.innerWidth);
        const delta = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
        if (Math.abs(delta) >= 16 && event.timeStamp - lastWheelStepAt >= SHIFT_WHEEL_COOLDOWN_MS) {
          lastWheelStepAt = event.timeStamp;
          trigger(delta > 0 ? 1 : -1);
        }
        return;
      }

      if (event.shiftKey || !isInsideDrawerWithoutHorizontalScroll(event.target)) {
        state = IDLE_SWIPE;
        return;
      }

      const dx = wheelPixels(event.deltaX, event.deltaMode, window.innerWidth);
      const dy = wheelPixels(event.deltaY, event.deltaMode, window.innerHeight);
      const step = swipeStep(state, dx, dy, event.timeStamp);
      state = step.state;
      if (step.turn === null) return;
      trigger(step.turn);
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [options.enabled]);
}
