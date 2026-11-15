import { useCallback, useEffect, useRef, useState } from "react";
import { listenClipboardItemCopied, type ClipboardHistoryItem } from "./api";

export function useClipboardCopyCard(enabled: boolean) {
  const [current, setCurrent] = useState<{ item: ClipboardHistoryItem; key: number } | null>(null);
  const timer = useRef(0);
  const shownFor = useRef(0);

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
    if (!enabled) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenClipboardItemCopied(({ item, seconds }) => {
      if (seconds <= 0) return;
      shownFor.current = seconds * 1000;
      setCurrent({ item, key: Date.now() });
      release();
    }).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    }).catch((error: unknown) => console.error("Failed to listen for clipboard copies", error));
    return () => {
      cancelled = true;
      stop?.();
      window.clearTimeout(timer.current);
      setCurrent(null);
    };
  }, [enabled, release]);

  return { current, dismiss, hold, release };
}

export type ClipboardCopyCardState = ReturnType<typeof useClipboardCopyCard>;
