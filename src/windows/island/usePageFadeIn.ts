import { useLayoutEffect, useRef } from "react";
import type { IslandMode, IslandPage } from "./types";

const FADE_IN_DURATION_MS = 220;

export function usePageFadeIn<T extends HTMLElement>(page: IslandPage, mode: IslandMode) {
  const contentRef = useRef<T>(null);
  const previousPageRef = useRef(page);

  useLayoutEffect(() => {
    const previousPage = previousPageRef.current;
    previousPageRef.current = page;
    const content = contentRef.current;
    if (
      previousPage === page ||
      mode !== "expanded" ||
      !content ||
      typeof content.animate !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const animation = content.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: FADE_IN_DURATION_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    return () => animation.cancel();
  }, [mode, page]);

  return contentRef;
}
