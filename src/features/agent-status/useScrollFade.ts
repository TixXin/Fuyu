import { useCallback, useEffect, useState } from "react";

const EDGE_PX = 2;

export function useScrollFade<T extends HTMLElement>(contentKey: unknown) {
  const [element, setElement] = useState<T | null>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });

  const update = useCallback(() => {
    if (!element) return;
    const top = element.scrollTop > EDGE_PX;
    const bottom = element.scrollHeight - element.clientHeight - element.scrollTop > EDGE_PX;
    setFade((current) => (current.top === top && current.bottom === bottom ? current : { top, bottom }));
  }, [element]);

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, update]);

  useEffect(update, [update, contentKey]);

  return { ref: setElement, element, fade, onScroll: update };
}
