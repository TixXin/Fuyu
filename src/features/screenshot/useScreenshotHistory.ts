import { useCallback, useEffect, useState } from "react";
import { getScreenshotHistory, listenScreenshotHistory, type HistoryItem } from "./api";

let cachedHistoryItems: HistoryItem[] | null = null;

export function useScreenshotHistory() {
  const [items, setItems] = useState<HistoryItem[] | null>(() => cachedHistoryItems);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(() => {
    getScreenshotHistory()
      .then((next) => {
        const list = Array.isArray(next) ? next : [];
        cachedHistoryItems = list;
        setItems(list);
        setError(null);
      })
      .catch(setError);
  }, []);

  useEffect(() => {
    refresh();
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenScreenshotHistory(refresh)
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((failure: unknown) => console.error("Failed to listen for the screenshot history", failure));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [refresh]);

  const forget = useCallback((path: string) => {
    setItems((current) => {
      const next = current?.filter((item) => item.path !== path) ?? current;
      if (next) cachedHistoryItems = next;
      return next;
    });
  }, []);

  return { items, error, refresh, forget };
}
