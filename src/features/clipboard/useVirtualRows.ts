import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { visibleRows, visibleSlots } from "./virtualRows";

const OVERSCAN = 6;

type Range = { start: number; end: number };

function useVirtualRange(
  container: RefObject<HTMLElement | null>,
  compute: (top: number, height: number) => Range,
): Range {
  const [, setTick] = useState(0);
  const scrollRef = useRef({ top: 0, height: 600 });
  const computeRef = useRef(compute);
  computeRef.current = compute;

  const element = container.current;
  const top = element ? element.scrollTop : scrollRef.current.top;
  scrollRef.current.top = top;
  const current = compute(top, scrollRef.current.height);
  const renderedRef = useRef<Range>(current);
  renderedRef.current = current;

  useLayoutEffect(() => {
    const node = container.current;
    if (!node) return;

    const checkRange = () => {
      const next = computeRef.current(scrollRef.current.top, scrollRef.current.height);
      const prev = renderedRef.current;
      if (next.start !== prev.start || next.end !== prev.end) {
        renderedRef.current = next;
        setTick((value) => value + 1);
      }
    };

    const onScroll = () => {
      scrollRef.current.top = node.scrollTop;
      checkRange();
    };

    const onResize = () => {
      scrollRef.current.top = node.scrollTop;
      scrollRef.current.height = node.clientHeight || 600;
      checkRange();
    };

    onResize();
    node.addEventListener("scroll", onScroll, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize);
    observer?.observe(node);
    return () => {
      node.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [container]);

  return current;
}

export function useVirtualRows(container: RefObject<HTMLElement | null>, count: number, rowHeight: number) {
  const { start, end } = useVirtualRange(
    container,
    (top, height) => visibleRows(count, rowHeight, top, height, OVERSCAN),
  );

  const scrollToIndex = useCallback((index: number) => {
    const element = container.current;
    if (!element) return;
    const top = index * rowHeight;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + rowHeight > element.scrollTop + element.clientHeight) element.scrollTop = top + rowHeight - element.clientHeight;
  }, [container, rowHeight]);

  return { start, end, before: start * rowHeight, after: (count - end) * rowHeight, scrollToIndex };
}

export function useVirtualSlots(container: RefObject<HTMLElement | null>, offsets: readonly number[], inset: number) {
  const { start, end } = useVirtualRange(
    container,
    (top, height) => visibleSlots(offsets, Math.max(0, top - inset), height, OVERSCAN),
  );

  const scrollToIndex = useCallback((index: number) => {
    const element = container.current;
    if (!element || index < 0 || index >= offsets.length - 1) return;
    const top = index === 0 ? 0 : offsets[index] + inset;
    const bottom = offsets[index + 1] + inset;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (bottom > element.scrollTop + element.clientHeight) element.scrollTop = bottom - element.clientHeight;
  }, [container, offsets, inset]);

  return { start, end, scrollToIndex };
}
