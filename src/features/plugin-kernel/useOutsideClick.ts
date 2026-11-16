import { useEffect, useLayoutEffect, useRef } from "react";
import type { IslandHost } from "./islandHost";

function report(error: unknown) {
  console.error("Failed to watch for clicks outside the island", error);
}

export function useOutsideClick(watching: boolean, onOutsideClick: () => void, host: Pick<IslandHost, "listenOutsideClick" | "setOutsideClickWatch">) {
  const handlerRef = useRef(onOutsideClick);
  useLayoutEffect(() => {
    handlerRef.current = onOutsideClick;
  });

  useEffect(() => {
    if (!watching) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void host.listenOutsideClick(() => handlerRef.current())
      .then((stop) => (cancelled ? stop() : (unlisten = stop)))
      .catch(report);
    void host.setOutsideClickWatch(true).catch(report);
    return () => {
      cancelled = true;
      unlisten?.();
      void host.setOutsideClickWatch(false).catch(report);
    };
  }, [watching, host]);
}
