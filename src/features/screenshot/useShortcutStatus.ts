import { useEffect, useState } from "react";
import { getScreenshotShortcutStatus, listenScreenshotShortcutStatus, type ShortcutStatus } from "./api";

export function useShortcutStatus() {
  const [status, setStatus] = useState<ShortcutStatus[]>([]);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    getScreenshotShortcutStatus()
      .then((current) => { if (!cancelled) setStatus(Array.isArray(current) ? current : []); })
      .catch((error: unknown) => console.error("Failed to read the screenshot shortcuts", error));
    void listenScreenshotShortcutStatus((event) => setStatus(event.payload))
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the screenshot shortcuts", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return status;
}
