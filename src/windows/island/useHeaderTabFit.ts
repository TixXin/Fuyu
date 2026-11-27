import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { layoutZoom } from "../../lib/layoutZoom";
import { fitHeaderTabs, HEADER_GAP, HEADER_MORE_WIDTH, HEADER_TAB_WIDTH, HEADER_TEXT_TAB_ESTIMATE, type HeaderTabFit } from "./headerTabFit";

export type HeaderTabFitRefs = {
  header: RefObject<HTMLElement | null>;
  title: RefObject<HTMLDivElement | null>;
  row: RefObject<HTMLDivElement | null>;
  more: RefObject<HTMLButtonElement | null>;
  actions: readonly RefObject<HTMLDivElement | null>[];
};

export type HeaderTabMetric = {
  id: string;
  textIcon: boolean;
};

type WidthCache = {
  full: Map<string, number>;
  compact: Map<string, number>;
  fullExtra: number | null;
  compactExtra: number | null;
  more: number;
};

const TAB_BUTTONS = ":scope > button:not(.island__header-more)";

const emptyCache = (): WidthCache => ({ full: new Map(), compact: new Map(), fullExtra: null, compactExtra: null, more: 0 });

export function useHeaderTabFit(
  enabled: boolean,
  refs: HeaderTabFitRefs,
  items: readonly HeaderTabMetric[],
  split: number,
  resetKey: string,
): HeaderTabFit {
  const key = `${enabled}|${resetKey}|${items.map((item) => item.id).join(",")}`;
  const [state, setState] = useState<{ key: string; fit: HeaderTabFit }>({ key, fit: { compact: false, visible: items.length } });
  let fit = state.fit;
  if (state.key !== key) {
    fit = { compact: false, visible: items.length };
    setState({ key, fit });
  }
  const cacheRef = useRef<WidthCache>(emptyCache());
  const keyRef = useRef<string | null>(null);
  const latestRef = useRef({ refs, items, split, fit });
  latestRef.current = { refs, items, split, fit };

  const measure = useCallback(() => {
    const { refs: current, items: tabs, split: titleCount, fit: shown } = latestRef.current;
    const header = current.header.current;
    const row = current.row.current;
    if (!header || !row || header.offsetWidth <= 0) return;
    const zoom = layoutZoom(header);
    const width = (element: Element) => element.getBoundingClientRect().width / zoom;
    const cache = cacheRef.current;
    const title = current.title.current;
    const titleButtons = title ? [...title.querySelectorAll<HTMLElement>(TAB_BUTTONS)] : [];
    const measured = shown.compact ? cache.compact : cache.full;
    [...titleButtons, ...row.querySelectorAll<HTMLElement>(TAB_BUTTONS)].forEach((button, index) => {
      if (index < tabs.length && button.offsetWidth > 0) measured.set(tabs[index].id, width(button));
    });
    if (title && title.offsetWidth > 0) {
      const extra = width(title) + HEADER_GAP - titleButtons.reduce((sum, button) => sum + width(button) + HEADER_GAP, 0);
      if (shown.compact) cache.compactExtra = extra;
      else cache.fullExtra = extra;
    }
    const more = current.more.current;
    if (more && more.offsetWidth > 0) cache.more = width(more);
    const actions = current.actions.reduce((sum, ref) => sum + (ref.current ? width(ref.current) : 0), 0);
    const columnGap = Number.parseFloat(getComputedStyle(header).columnGap) || 0;
    const available = width(header) - actions - columnGap * (current.actions.length + 2);
    const iconTab = tabs.find((tab) => !tab.textIcon && cache.full.has(tab.id));
    const fallback = cache.compact.values().next().value ?? (iconTab ? cache.full.get(iconTab.id) : undefined) ?? HEADER_TAB_WIDTH;
    const fullExtra = cache.fullExtra ?? 0;
    const next = fitHeaderTabs({
      available,
      split: titleCount,
      full: tabs.map((tab) => cache.full.get(tab.id) ?? (tab.textIcon ? HEADER_TEXT_TAB_ESTIMATE : fallback)),
      compact: tabs.map((tab) => cache.compact.get(tab.id) ?? fallback),
      fullExtra,
      compactExtra: cache.compactExtra ?? fullExtra,
      rowMin: Number.parseFloat(getComputedStyle(row).minWidth) || 0,
      more: cache.more || HEADER_MORE_WIDTH,
    });
    setState((value) => (value.fit.compact === next.compact && value.fit.visible === next.visible ? value : { key: value.key, fit: next }));
  }, []);

  useLayoutEffect(() => {
    if (!enabled) return;
    if (keyRef.current !== key) {
      keyRef.current = key;
      cacheRef.current = emptyCache();
    }
    measure();
  }, [enabled, key, fit, measure]);

  useEffect(() => {
    if (!enabled || typeof ResizeObserver === "undefined") return;
    const { refs: current } = latestRef.current;
    const observer = new ResizeObserver(measure);
    for (const ref of [current.header, current.title, current.row, ...current.actions]) {
      if (ref.current) observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, [enabled, measure]);

  if (!enabled) return { compact: false, visible: items.length };
  return { compact: fit.compact, visible: Math.min(fit.visible, items.length) };
}
