import { useEffect, type RefObject } from "react";
import { setOnboardingCardRects, type CardRect } from "./api";

function sameRects(a: readonly CardRect[] | null, b: readonly CardRect[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      Math.abs(a[i].x - b[i].x) >= 1 ||
      Math.abs(a[i].y - b[i].y) >= 1 ||
      Math.abs(a[i].width - b[i].width) >= 1 ||
      Math.abs(a[i].height - b[i].height) >= 1
    ) {
      return false;
    }
  }
  return true;
}

export function useCardRect(
  targets: readonly RefObject<HTMLElement | null>[],
  placementKey: string,
  fullScreenOverlay = false,
) {
  useEffect(() => {
    let frame = 0;
    let last: CardRect[] | null = null;
    const collect = (): CardRect[] => {
      if (fullScreenOverlay) {
        return [{ x: 0, y: 0, width: Math.round(window.innerWidth), height: Math.round(window.innerHeight) }];
      }
      const rects: CardRect[] = [];
      for (const ref of targets) {
        const element = ref.current;
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          rects.push({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) });
        }
      }
      return rects;
    };
    const sendNow = () => {
      frame = 0;
      const next = collect();
      if (sameRects(last, next)) return;
      last = next;
      void setOnboardingCardRects(next).catch(() => undefined);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sendNow);
    };
    sendNow();
    const observer = new ResizeObserver(schedule);
    const elements: HTMLElement[] = [];
    for (const ref of targets) {
      if (ref.current) {
        observer.observe(ref.current);
        ref.current.addEventListener("transitionend", schedule);
        elements.push(ref.current);
      }
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      for (const element of elements) element.removeEventListener("transitionend", schedule);
    };
  }, [targets, placementKey, fullScreenOverlay]);
}
