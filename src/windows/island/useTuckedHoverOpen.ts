import { useCallback, useEffect, useRef } from "react";
import { listenIslandHover } from "./api";

const MIN_OPEN_DELAY_MS = 320;

type TuckedHoverOptions = {
  opensPanel: boolean;
  delayMs: number;
  isPeeking: boolean;
  onPeek: () => void;
  onOpen: () => void;
  retractsAfterPeek: boolean;
  resumePeek: () => void;
};

export function useTuckedHoverOpen(options: TuckedHoverOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const hoveringRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const scheduleOpen = useCallback(() => {
    window.clearTimeout(timerRef.current);
    if (!optionsRef.current.opensPanel) return;
    timerRef.current = window.setTimeout(() => {
      if (!hoveringRef.current && !document.querySelector(".island:hover")) return;
      const { onOpen, retractsAfterPeek, resumePeek } = optionsRef.current;
      onOpen();
      if (retractsAfterPeek) resumePeek();
    }, Math.max(optionsRef.current.delayMs, MIN_OPEN_DELAY_MS));
  }, []);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenIslandHover((inside) => {
      hoveringRef.current = inside;
      if (!inside) window.clearTimeout(timerRef.current);
      else if (optionsRef.current.isPeeking) scheduleOpen();
    })
      .then((next) => {
        if (didCancel) next();
        else unlisten = next;
      })
      .catch((error) => console.error("Failed to listen for island hover", error));
    return () => {
      didCancel = true;
      unlisten?.();
      window.clearTimeout(timerRef.current);
    };
  }, [scheduleOpen]);

  return useCallback(() => {
    optionsRef.current.onPeek();
    scheduleOpen();
  }, [scheduleOpen]);
}
