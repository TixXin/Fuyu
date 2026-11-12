import { useLayoutEffect, useRef } from "react";
import type { IslandMode, IslandPage } from "./types";

// Short enough to finish well inside the 500ms height transition it plays alongside.
const FADE_IN_DURATION_MS = 220;

/**
 * Fades the expanded content in when the open page changes, so the new page does not
 * pop in while the island is still resizing. Uses the Web Animations API instead of
 * remounting with a key, so the pages keep their state.
 */
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

    // Opacity only, as the island's layers: a transform slide moves the page by fractions of a
    // device pixel each frame, so its text blurs and steps a pixel, and lands once more when the
    // slide ends (docs/investigations/island-jitter.md, fifth round).
    const animation = content.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: FADE_IN_DURATION_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    return () => animation.cancel();
  }, [mode, page]);

  return contentRef;
}
