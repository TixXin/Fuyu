import { useEffect, type RefObject } from "react";

export function useRowOverflow(rowRef: RefObject<HTMLElement | null>, enabled: boolean, key: unknown) {
  useEffect(() => {
    const row = rowRef.current;
    if (!row || !enabled) return;
    const update = () => {
      if (row.scrollWidth - row.clientWidth - row.scrollLeft > 1) row.dataset.overflow = "end";
      else delete row.dataset.overflow;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    for (const child of row.children) observer.observe(child);
    row.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      row.removeEventListener("scroll", update);
      delete row.dataset.overflow;
    };
  }, [rowRef, enabled, key]);
}
