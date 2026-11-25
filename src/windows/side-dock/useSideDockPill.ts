import { useCallback, useEffect, useRef, type RefObject } from "react";

type PillAxis = "x" | "y";

export function useSideDockPill(
  containerRef: RefObject<HTMLElement | null>,
  axis: PillAxis,
  activeKey: string,
  reducedMotion: boolean,
) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef(false);

  const place = useCallback(
    (instant: boolean) => {
      const container = containerRef.current;
      const pill = pillRef.current;
      if (!container || !pill) return;
      const active = container.querySelector<HTMLElement>("[data-active='true']");
      if (!active) {
        pill.dataset.shown = "false";
        shownRef.current = false;
        return;
      }
      const skip = instant || reducedMotion || !shownRef.current;
      pill.dataset.instant = skip ? "true" : "false";
      if (axis === "x") {
        pill.style.left = `${active.offsetLeft}px`;
        pill.style.width = `${active.offsetWidth}px`;
        pill.style.top = `${active.offsetTop}px`;
        pill.style.height = `${active.offsetHeight}px`;
      } else {
        const inset = Math.round(active.offsetHeight * 0.22);
        pill.style.top = `${active.offsetTop + inset}px`;
        pill.style.height = `${Math.max(12, active.offsetHeight - inset * 2)}px`;
      }
      pill.dataset.shown = "true";
      shownRef.current = true;
    },
    [axis, containerRef, reducedMotion],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => place(false));
    return () => window.cancelAnimationFrame(frame);
  }, [activeKey, place]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sync = () => place(true);
    const observer = new ResizeObserver(sync);
    observer.observe(container);
    container.addEventListener("scroll", sync, { passive: true });
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", sync);
    };
  }, [containerRef, place]);

  return pillRef;
}
