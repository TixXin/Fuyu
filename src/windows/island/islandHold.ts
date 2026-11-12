import { useEffect } from "react";
import { listenIslandHold } from "./api";

let held = false;

export function isIslandHeld() {
  return held;
}

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
