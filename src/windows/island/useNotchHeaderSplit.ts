import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { NOTCH_MORE_WIDTH, NOTCH_TAB_GAP, NOTCH_TAB_WIDTH, NOTCH_TEXT_TAB_ESTIMATE, splitNotchHeaderTabs } from "./notchHeaderOverflow";

export type NotchHeaderTabMetric = {
  id: string;
  textIcon: boolean;
};

export function useNotchHeaderSplit(
  enabled: boolean,
  startRef: RefObject<HTMLDivElement | null>,
  titleRef: RefObject<HTMLDivElement | null>,
  dotsRef: RefObject<HTMLDivElement | null>,
  moreElRef: RefObject<HTMLButtonElement | null>,
  items: readonly NotchHeaderTabMetric[],
  iconKey: string,
): number {
  const widthsRef = useRef<Map<string, number>>(new Map());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const lastIconKeyRef = useRef(iconKey);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const itemsKey = items.map((item) => `${item.id}:${item.textIcon ? 1 : 0}`).join(",");

  if (lastIconKeyRef.current !== iconKey) {
    lastIconKeyRef.current = iconKey;
    widthsRef.current.clear();
  }

  const measure = useCallback(() => {
    const start = startRef.current;
    if (!start) return;
    const dots = dotsRef.current;
    if (dots) {
      const currentItems = itemsRef.current;
      for (let index = 0; index < dots.children.length && index < currentItems.length; index += 1) {
        const child = dots.children[index];
        if (child instanceof HTMLElement && child.offsetWidth > 0) {
          widthsRef.current.set(currentItems[index].id, child.offsetWidth);
        }
      }
    }
    const title = titleRef.current;
    const titleWidth = title && title.offsetWidth > 0 ? title.offsetWidth + NOTCH_TAB_GAP : 0;
    const available = Math.max(0, start.clientWidth - titleWidth);
    const moreWidth = moreElRef.current && moreElRef.current.offsetWidth > 0 ? moreElRef.current.offsetWidth : NOTCH_MORE_WIDTH;
    const widths = itemsRef.current.map((item) => widthsRef.current.get(item.id) ?? (item.textIcon ? NOTCH_TEXT_TAB_ESTIMATE : NOTCH_TAB_WIDTH));
    const next = splitNotchHeaderTabs(available, widths, moreWidth, NOTCH_TAB_GAP);
    setVisibleCount((current) => (current === next ? current : next));
  }, [startRef, titleRef, dotsRef, moreElRef]);

  useLayoutEffect(() => {
    if (!enabled) return;
    measure();
  }, [enabled, measure, itemsKey, iconKey, visibleCount]);

  useEffect(() => {
    if (!enabled) return;
    const start = startRef.current;
    if (!start || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(start);
    if (titleRef.current) observer.observe(titleRef.current);
    return () => observer.disconnect();
  }, [enabled, startRef, titleRef, measure]);

  return enabled ? Math.min(visibleCount, items.length) : items.length;
}
