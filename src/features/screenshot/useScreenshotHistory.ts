import { useCallback, useEffect, useState } from "react";
import { getScreenshotHistory, listenScreenshotHistory, type HistoryItem } from "./api";

export function useScreenshotHistory() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(() => {
    getScreenshotHistory()
      .then((next) => {
        setItems(Array.isArray(next) ? next : []);
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

  const forget = useCallback((path: string) => setItems((current) => current?.filter((item) => item.path !== path) ?? current), []);

  return { items, error, refresh, forget };
}
