import { useLayoutEffect, type RefObject } from "react";
import { collapsedContent, measureCollapsedContent } from "./collapsedContent";

export function useCollapsedContent(barRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || !enabled) {
      collapsedContent.report(0);
      return;
    }
    const measure = () => collapsedContent.report(measureCollapsedContent(bar));
    measure();
    if (typeof ResizeObserver === "undefined" || typeof MutationObserver === "undefined") return () => collapsedContent.report(0);
    const sizes = new ResizeObserver(measure);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(bar);
      for (const child of bar.children) sizes.observe(child);
      for (const item of bar.querySelectorAll("[data-fit-item] > *, .island__center-slot")) sizes.observe(item);
    };
    watch();
    const tree = new MutationObserver(() => {
      watch();
      measure();
    });
    tree.observe(bar, { childList: true, subtree: true });
    return () => {
      tree.disconnect();
      sizes.disconnect();
      collapsedContent.report(0);
    };
  }, [barRef, enabled]);
}
