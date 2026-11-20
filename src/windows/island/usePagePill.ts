import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const ACTIVE = ".dot-button--active, .island__agent-button--active";

export function usePagePill(headerRef: RefObject<HTMLElement | null>, scrollRef: RefObject<HTMLElement | null>, key: string) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const lastLeft = useRef<number | null>(null);

  const place = useCallback((instant: boolean) => {
    const header = headerRef.current;
    const pill = pillRef.current;
    if (!header || !pill) return;
    const active = header.querySelector<HTMLElement>(ACTIVE);
    if (!active) {
      pill.dataset.shown = "false";
      lastLeft.current = null;
      return;
    }
    const box = header.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    const left = rect.left - box.left;
    const fresh = lastLeft.current === null || pill.dataset.shown !== "true";
    pill.dataset.instant = instant || fresh ? "true" : "false";
    if (!instant && !fresh && lastLeft.current !== null && left !== lastLeft.current) {
      pill.dataset.dir = left > lastLeft.current ? "forward" : "back";
    }
    pill.style.left = `${left}px`;
    pill.style.right = `${box.right - rect.right}px`;
    pill.style.top = `${rect.top - box.top}px`;
    pill.style.height = `${rect.height}px`;
    pill.dataset.shown = "true";
    lastLeft.current = left;
  }, [headerRef]);

  useLayoutEffect(() => {
    place(false);
  }, [place, key]);

  useEffect(() => {
    const header = headerRef.current;
    const row = scrollRef.current;
    if (!header) return;
    const follow = () => place(true);
    const observer = new ResizeObserver(follow);
    observer.observe(header);
    row?.addEventListener("scroll", follow, { passive: true });
    return () => {
      observer.disconnect();
      row?.removeEventListener("scroll", follow);
    };
  }, [headerRef, scrollRef, place]);

  return pillRef;
}
