import { useEffect, useRef, type RefObject } from "react";

const PAGE_TRIGGER = 30;
const PAGE_REST_MS = 420;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function useWheelScrollsSideways(ref: RefObject<HTMLElement | null>, pageWidth: number | null = null) {
  const page = useRef(pageWidth);
  page.current = pageWidth;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let pending = 0;
    let restUntil = 0;
    const turnPage = (width: number, delta: number) => {
      const now = performance.now();
      if (now < restUntil) return;
      pending += delta;
      if (Math.abs(pending) < PAGE_TRIGGER) return;
      const current = Math.round(element.scrollLeft / width);
      const last = Math.ceil((element.scrollWidth - element.clientWidth) / width);
      const next = Math.min(Math.max(current + Math.sign(pending), 0), last);
      pending = 0;
      restUntil = now + PAGE_REST_MS;
      element.scrollTo({ left: next * width, behavior: reducedMotion() ? "auto" : "smooth" });
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || element.scrollWidth <= element.clientWidth) return;
      event.preventDefault();
      const width = page.current;
      if (width && width > 0) turnPage(width, event.deltaY);
      else element.scrollLeft += event.deltaY;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [ref]);
}
