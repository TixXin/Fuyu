import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClipboardHistoryItem } from "./api";
import { matchesClipboardQuery } from "./clipboardSearch";

export type ClipboardView = "all" | "favorites" | "images" | "files";

/** The tags used most, for the filter row: at most `limit`, the most used first. */
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
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return viewedItems;
    }

    return viewedItems.filter((item) => matchesClipboardQuery(item, normalizedQuery));
  }, [normalizedQuery, viewedItems]);

  useLayoutEffect(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id));
    const nextPositions = new Map<string, DOMRect>();
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    itemElementsRef.current.forEach((element, id) => {
      if (!visibleIds.has(id)) {
        return;
      }

      const nextRect = element.getBoundingClientRect();
      const previousRect = itemPositionsRef.current.get(id);
      nextPositions.set(id, nextRect);

      if (!previousRect || prefersReducedMotion) {
        return;
      }

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }

      element.getAnimations().forEach((animation) => animation.cancel());
      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 280,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        },
      );
    });

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
