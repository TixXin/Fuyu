import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClipboardHistoryItem } from "./api";
import { loadPinyin, matchesPopupQuery, parsePopupQuery } from "./popupQuery";
import { MOTION_EASE } from "../../lib/theme/motionTokens";

export type ClipboardView = "all" | "favorites" | "images" | "files";

export function topTags(items: ClipboardHistoryItem[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const item of items) for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([tag]) => tag);
}

function inView(item: ClipboardHistoryItem, view: ClipboardView) {
  if (view === "favorites") return Boolean(item.favorite);
  if (view === "images") return item.kind === "image";
  if (view === "files") return item.kind === "files";
  return true;
}

const MAX_FLIP_ITEMS = 20;

export function useClipboardHistoryList(items: ClipboardHistoryItem[]) {
  const [query, setQuery] = useState("");
  const [clipboardView, setClipboardView] = useState<ClipboardView>("all");
  const itemElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const itemPositionsRef = useRef<Map<string, DOMRect>>(new Map());
  const normalizedQuery = query.trim().toLowerCase();
  const favoriteItems = useMemo(
    () => items.filter((item) => item.favorite),
    [items],
  );
  const viewedItems = useMemo(() => (clipboardView === "favorites" ? favoriteItems : items.filter((item) => inView(item, clipboardView))), [clipboardView, favoriteItems, items]);
  const parsedQuery = useMemo(() => (normalizedQuery ? parsePopupQuery(normalizedQuery) : null), [normalizedQuery]);
  const needsPinyin = useMemo(() => parsedQuery !== null && parsedQuery.words.some((w) => /^[a-z]+$/.test(w)), [parsedQuery]);
  const [pinyinReady, setPinyinReady] = useState(false);
  useEffect(() => {
    if (!needsPinyin || pinyinReady) return;
    let cancelled = false;
    void loadPinyin().then((pinyin) => { if (!cancelled) setPinyinReady(pinyin !== null); });
    return () => { cancelled = true; };
  }, [needsPinyin, pinyinReady]);
  const filteredItems = useMemo(() => {
    if (!parsedQuery) {
      return viewedItems;
    }

    const now = Date.now();
    return viewedItems.filter((item) => matchesPopupQuery(item, parsedQuery, now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedQuery, viewedItems, pinyinReady]);

  useLayoutEffect(() => {
    const nextPositions = new Map<string, DOMRect>();
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      itemPositionsRef.current = nextPositions;
      return;
    }

    let measured = 0;
    for (const item of filteredItems) {
      if (measured >= MAX_FLIP_ITEMS) {
        break;
      }
      const element = itemElementsRef.current.get(item.id);
      if (!element) {
        continue;
      }
      measured += 1;
      const nextRect = element.getBoundingClientRect();
      if (nextRect.width === 0 && nextRect.height === 0) {
        continue;
      }
      const previousRect = itemPositionsRef.current.get(item.id);
      nextPositions.set(item.id, nextRect);

      if (!previousRect) {
        continue;
      }

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        continue;
      }

      element.getAnimations().forEach((animation) => animation.cancel());
      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 280,
          easing: MOTION_EASE,
        },
      );
    }

    itemPositionsRef.current = nextPositions;
  }, [filteredItems]);

  return {
    query,
    setQuery,
    clipboardView,
    setClipboardView,
    favoriteItems,
    filteredItems,
    itemElementsRef,
  };
}
