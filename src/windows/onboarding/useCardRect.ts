import { useEffect, type RefObject } from "react";
import { setOnboardingCardRects, type CardRect } from "./api";

function changed(previous: CardRect | null, next: CardRect): boolean {
  if (!previous) return true;
  return (
    Math.abs(previous.x - next.x) >= 1 ||
    Math.abs(previous.y - next.y) >= 1 ||
    Math.abs(previous.width - next.width) >= 1 ||
    Math.abs(previous.height - next.height) >= 1
  );
}

export function useCardRect(card: RefObject<HTMLElement | null>, placementKey: string) {
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    let frame = 0;
    let last: CardRect | null = null;
    const sendNow = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const next: CardRect = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
      if (!changed(last, next)) return;
      last = next;
      void setOnboardingCardRects([next]).catch(() => undefined);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sendNow);
    };
    sendNow();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    element.addEventListener("transitionend", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener("transitionend", schedule);
    };
  }, [card, placementKey]);
}
