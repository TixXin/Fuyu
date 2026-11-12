import { useCallback, useEffect, useRef, useState } from "react";
import { listenScreenshotTaken, type ScreenshotTaken } from "./api";

export function useScreenshotCard(seconds: number) {
  const [current, setCurrent] = useState<ScreenshotTaken | null>(null);
  const timer = useRef(0);
  const shownFor = useRef(seconds * 1000);
  useEffect(() => { shownFor.current = seconds * 1000; }, [seconds]);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setCurrent(null);
  }, []);
  const release = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCurrent(null), shownFor.current);
  }, []);
  const hold = useCallback(() => window.clearTimeout(timer.current), []);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenScreenshotTaken((event) => {
      if (shownFor.current <= 0) return;
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
