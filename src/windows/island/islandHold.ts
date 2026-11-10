import { useEffect } from "react";
import { listenIslandHold } from "./api";

// One flag for the window: the closing paths ask it when they are about to close.
let held = false;

/**
 * Whether the expanded island should stay open (C25): Alt is held, or the panel is being resized.
 * Hover and blur closing check this and try again later instead of closing.
 */
export function isIslandHeld() {
  return held;
}

/** Keeps `isIslandHeld` in step with the native side; mount once, in the island window. */
export function useIslandHoldListener() {
  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenIslandHold((next) => {
      held = next;
    })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the island hold", error));
    return () => {
      cancelled = true;
      held = false;
      stop?.();
    };
  }, []);
}
