import { useEffect, type RefObject } from "react";
import { setOnboardingCardRects } from "./api";

/**
 * Hands the card's rectangle to the native side, which then lets the card take the pointer while
 * everything else on the overlay lets it through to the island and the desktop. Sent again when the
 * card changes size or finishes moving; `placementKey` changes whenever it is placed elsewhere.
 */
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
