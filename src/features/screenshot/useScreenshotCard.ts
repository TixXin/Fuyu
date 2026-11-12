import { useCallback, useEffect, useRef, useState } from "react";
import { listenScreenshotTaken, type ScreenshotTaken } from "./api";

/** How long the card stays without the pointer on it. */
export const CARD_MS = 8_000;

/**
 * The island's screenshot card (C41.5): the last screenshot copied or saved, for a few seconds.
 * The pointer on the card holds it; leaving starts the time again.
 */
export function useScreenshotCard() {
  const [current, setCurrent] = useState<ScreenshotTaken | null>(null);
  const timer = useRef(0);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setCurrent(null);
  }, []);
  const release = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCurrent(null), CARD_MS);
  }, []);
  const hold = useCallback(() => window.clearTimeout(timer.current), []);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenScreenshotTaken((event) => {
      setCurrent(event.payload);
      release();
    }).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    }).catch((error: unknown) => console.error("Failed to listen for screenshots", error));
    return () => {
      cancelled = true;
      stop?.();
      window.clearTimeout(timer.current);
    };
  }, [release]);

  return { current, dismiss, hold, release };
}

export type ScreenshotCardState = ReturnType<typeof useScreenshotCard>;
