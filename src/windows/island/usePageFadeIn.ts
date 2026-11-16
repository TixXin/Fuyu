import { useLayoutEffect, useRef } from "react";
import { MOTION_EASE_OUT, MOTION_MEDIUM_MS } from "../../lib/theme/motionTokens";
import type { IslandMode, IslandPage } from "./types";

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
      { duration: MOTION_MEDIUM_MS, easing: MOTION_EASE_OUT },
    );
    return () => animation.cancel();
  }, [mode, page]);

  return contentRef;
}
