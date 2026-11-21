import { useEffect } from "react";
import { listenIslandHold } from "./api";
import { isPanelEditing } from "./custom-panels/panelEditing";
import { isResizeEditing } from "./resize/session";

let held = false;
let releasedAt = Number.NEGATIVE_INFINITY;

export function isIslandHeld() {
  return held || isPanelEditing() || isResizeEditing();
}

export function msSinceIslandRelease() {
  return performance.now() - releasedAt;
}

export function useIslandHoldListener() {
  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenIslandHold((next) => {
      if (held && !next) releasedAt = performance.now();
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
