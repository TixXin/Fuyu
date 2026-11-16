import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import { visibleRows, visibleSlots } from "./virtualRows";

const OVERSCAN = 6;

function useScrollView(container: RefObject<HTMLElement | null>) {
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

  return view;
}

export function useVirtualRows(container: RefObject<HTMLElement | null>, count: number, rowHeight: number) {
  const view = useScrollView(container);

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

export function useVirtualSlots(container: RefObject<HTMLElement | null>, offsets: readonly number[], inset: number) {
  const view = useScrollView(container);

  const scrollToIndex = useCallback((index: number) => {
    const element = container.current;
    if (!element || index < 0 || index >= offsets.length - 1) return;
    const top = index === 0 ? 0 : offsets[index] + inset;
    const bottom = offsets[index + 1] + inset;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (bottom > element.scrollTop + element.clientHeight) element.scrollTop = bottom - element.clientHeight;
  }, [container, offsets, inset]);

  const { start, end } = visibleSlots(offsets, Math.max(0, view.top - inset), view.height, OVERSCAN);
  return { start, end, scrollToIndex };
}
