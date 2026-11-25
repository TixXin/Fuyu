import { useEffect, useRef } from "react";
import { wheelPixels } from "../island/pageSwipe";
import { pulsePageArrow } from "../island/usePageArrowKeys";
import {
  IDLE_SIDE_SWIPE,
  SIDE_SWIPE_THRESHOLD_PX,
  SIDE_WHEEL_THRESHOLD_PX,
  stepSideDockGesture,
} from "./sideDockSwipe";

type SideDockSwipeOptions = {
  enabled: boolean;
  canStep: boolean;
  onStep: (direction: 1 | -1) => void;
};

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
    let drawerState = IDLE_SIDE_SWIPE;
    let stripState = IDLE_SIDE_SWIPE;

    const trigger = (turn: 1 | -1) => {
      latestRef.current.onStep(turn);
      pulsePageArrow(turn < 0 ? "previous" : "next");
    };

    const onWheel = (event: WheelEvent) => {
      if (!latestRef.current.canStep || event.ctrlKey || event.metaKey || event.altKey) return;
      const dx = wheelPixels(event.deltaX, event.deltaMode, window.innerWidth);
      const dy = wheelPixels(event.deltaY, event.deltaMode, window.innerHeight);

      if (isInsideNonScrollingStrip(event.target)) {
        const result = stepSideDockGesture(stripState, dy, dx, event.timeStamp, SIDE_WHEEL_THRESHOLD_PX, false);
        stripState = result.state;
        if (result.turn !== null) trigger(result.turn);
        return;
      }

      if (event.shiftKey && isInsideDrawerWithoutHorizontalScroll(event.target)) {
        const primary = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
        const result = stepSideDockGesture(drawerState, primary, 0, event.timeStamp, SIDE_WHEEL_THRESHOLD_PX, false);
        drawerState = result.state;
        if (result.turn !== null) trigger(result.turn);
        return;
      }

      if (event.shiftKey || !isInsideDrawerWithoutHorizontalScroll(event.target)) {
        drawerState = IDLE_SIDE_SWIPE;
        return;
      }

      const result = stepSideDockGesture(drawerState, dx, dy, event.timeStamp, SIDE_SWIPE_THRESHOLD_PX, true);
      drawerState = result.state;
      if (result.turn !== null) trigger(result.turn);
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [options.enabled]);
}
