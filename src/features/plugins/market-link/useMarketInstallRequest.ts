import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listenMarketInstallRequests, takeMarketInstallRequest } from "./api";

/**
 * The plugin a `fuyu://market/install/<id>` link asked to install, for the settings
 * window: taken when the window starts (a link that opened it) and whenever an open
 * window hears of a new one. `onRequest` runs with each id, to show the market page.
 * `dismiss` clears it once the user is done with it.
 */
export function useMarketInstallRequest(onRequest: (id: string) => void) {
  const [requestedId, setRequestedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    const take = () => {
      void takeMarketInstallRequest()
        .then((id) => {
          if (cancelled || !id) return;
          setRequestedId(id);
          onRequest(id);
        })
        .catch((error: unknown) => console.error("Failed to read a market install request", error));
    };
    take();
    void listenMarketInstallRequests(take)
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for market install requests", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [onRequest]);

  const dismiss = useCallback(() => setRequestedId(null), []);
  return { requestedId, dismiss };
}
