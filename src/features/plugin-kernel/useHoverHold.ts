import { useCallback, useEffect, useRef } from "react";
import { holdsOpen, type HoldsOpen } from "./hoverHold";
import type { IslandHost } from "./islandHost";

export function useHoverHold(host: Pick<IslandHost, "listenHover">): HoldsOpen {
  const hoveredRef = useRef(false);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void host.listenHover((inside) => {
      hoveredRef.current = inside;
    })
      .then((nextUnlisten) => {
        if (didCancel) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for island hover", error));
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, [host]);

  return useCallback((heldSince: number) => holdsOpen(hoveredRef.current, heldSince, Date.now()), []);
}
