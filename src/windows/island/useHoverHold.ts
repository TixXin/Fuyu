import { useCallback, useEffect, useRef } from "react";
import { listenIslandHover } from "./api";
import { holdsOpen, type HoldsOpen } from "./hoverHold";

export function useHoverHold(): HoldsOpen {
  const hoveredRef = useRef(false);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenIslandHover((inside) => {
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
  }, []);

  return useCallback((heldSince: number) => holdsOpen(hoveredRef.current, heldSince, Date.now()), []);
}
