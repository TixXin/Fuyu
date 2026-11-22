import { useCallback, useEffect, useRef } from "react";
import { listenIslandHover } from "./api";

const MIN_OPEN_DELAY_MS = 320;

type TuckedHoverOptions = {
  opensPanel: boolean;
  delayMs: number;
  peekDelayMs: number;
  isTucked?: boolean;
  isPeeking: boolean;
  onPeek: () => void;
  onOpen: () => void;
  retractsAfterPeek: boolean;
  resumePeek: () => void;
};

const stillOnIsland = (hovering: boolean) => hovering || document.querySelector(".island:hover") !== null;

export function useTuckedHoverOpen(options: TuckedHoverOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const hoveringRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const peekTimerRef = useRef<number | undefined>(undefined);

  const scheduleOpen = useCallback(() => {
    window.clearTimeout(timerRef.current);
    if (!optionsRef.current.opensPanel) return;
    timerRef.current = window.setTimeout(() => {
      if (!stillOnIsland(hoveringRef.current)) return;
      const { onOpen, retractsAfterPeek, resumePeek } = optionsRef.current;
      onOpen();
      if (retractsAfterPeek) resumePeek();
    }, Math.max(optionsRef.current.delayMs, MIN_OPEN_DELAY_MS));
  }, []);

  const cancelPeek = useCallback(() => {
    window.clearTimeout(peekTimerRef.current);
    peekTimerRef.current = undefined;
  }, []);

  const startPeek = useCallback(() => {
    const peek = () => {
      peekTimerRef.current = undefined;
      optionsRef.current.onPeek();
      scheduleOpen();
    };
    if (optionsRef.current.peekDelayMs <= 0) {
      cancelPeek();
      peek();
      return;
    }
    if (peekTimerRef.current !== undefined) return;
    peekTimerRef.current = window.setTimeout(() => {
      if (stillOnIsland(hoveringRef.current) && optionsRef.current.isTucked) peek();
      else peekTimerRef.current = undefined;
    }, optionsRef.current.peekDelayMs);
  }, [cancelPeek, scheduleOpen]);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenIslandHover((inside) => {
      hoveringRef.current = inside;
      if (!inside) {
        window.clearTimeout(timerRef.current);
        cancelPeek();
      } else if (optionsRef.current.isTucked) startPeek();
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
      cancelPeek();
    };
  }, [cancelPeek, scheduleOpen, startPeek]);

  return startPeek;
}
