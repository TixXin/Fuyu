import { useEffect, useLayoutEffect, useRef } from "react";
import { islandIsForeground, listenIslandFocus } from "./api";
import { isIslandHeld } from "./islandHold";

const WATCH_MS = 250;

export function useCollapseOnBlur(expanded: boolean, onCollapse: () => void) {
  const onCollapseRef = useRef(onCollapse);
  useLayoutEffect(() => {
    onCollapseRef.current = onCollapse;
  });

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    let timer: number | undefined;
    let unlisten: (() => void) | undefined;
    let generation = 0;
    const check = (asked: number) => {
      void islandIsForeground()
        .catch(() => false)
        .then((inFront) => {
          if (cancelled || asked !== generation) return;
          if (inFront || isIslandHeld()) timer = window.setTimeout(() => check(asked), WATCH_MS);
          else onCollapseRef.current();
        });
    };
    void listenIslandFocus((focused) => {
      generation += 1;
      window.clearTimeout(timer);
      if (!focused) check(generation);
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for island focus changes", error));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unlisten?.();
    };
  }, [expanded]);
}
