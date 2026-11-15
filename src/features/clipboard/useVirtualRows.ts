import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import { visibleRows } from "./virtualRows";

const OVERSCAN = 6;

export function useVirtualRows(container: RefObject<HTMLElement | null>, count: number, rowHeight: number) {
  const [view, setView] = useState({ top: 0, height: 600 });

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => setView({ top: element.scrollTop, height: element.clientHeight || 600 });
    measure();
    element.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      element.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [container]);

  const scrollToIndex = useCallback((index: number) => {
    const element = container.current;
    if (!element) return;
    const top = index * rowHeight;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + rowHeight > element.scrollTop + element.clientHeight) element.scrollTop = top + rowHeight - element.clientHeight;
  }, [container, rowHeight]);

  const { start, end } = visibleRows(count, rowHeight, view.top, view.height, OVERSCAN);
  return { start, end, before: start * rowHeight, after: (count - end) * rowHeight, scrollToIndex };
}
