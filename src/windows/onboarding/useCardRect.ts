import { useEffect, type RefObject } from "react";
import { setOnboardingCardRects } from "./api";

export function useCardRect(card: RefObject<HTMLElement | null>, placementKey: string) {
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const send = () => {
      const rect = element.getBoundingClientRect();
      void setOnboardingCardRects([{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }]).catch(() => undefined);
    };
    send();
    const observer = new ResizeObserver(send);
    observer.observe(element);
    element.addEventListener("transitionend", send);
    return () => {
      observer.disconnect();
      element.removeEventListener("transitionend", send);
    };
  }, [card, placementKey]);
}
