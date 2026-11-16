import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { resizeTrayMenu } from "./api";
import { focusFirstButton } from "./cardKeys";

function report(card: HTMLElement, last: { width: number; height: number } | null) {
  const rect = card.getBoundingClientRect();
  const size = { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
  if (last && last.width === size.width && last.height === size.height) return last;
  void resizeTrayMenu(size.width, size.height).catch((error: unknown) => console.error("Failed to resize the tray card", error));
  return size;
}

export function useTrayMenuSize(cardRef: RefObject<HTMLDivElement | null>, opened: number, settled: number) {
  const last = useRef<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (opened === 0 || !card) return;
    last.current = report(card, null);
    focusFirstButton(card);
  }, [cardRef, opened]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (settled === 0 || !card) return;
    last.current = report(card, last.current);
  }, [cardRef, settled]);

  useEffect(() => {
    const card = cardRef.current;
    if (opened === 0 || !card) return;
    const observer = new ResizeObserver(() => {
      if (document.hasFocus()) last.current = report(card, last.current);
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [cardRef, opened]);
}
