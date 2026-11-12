import { useEffect, useLayoutEffect, useRef } from "react";
import { listenIslandOutsideClick, setIslandOutsideClickWatch } from "./api";

function report(error: unknown) {
  console.error("Failed to watch for clicks outside the island", error);
}

export function useOutsideClick(watching: boolean, onOutsideClick: () => void) {
  const handlerRef = useRef(onOutsideClick);
  useLayoutEffect(() => {
    handlerRef.current = onOutsideClick;
  });

  useEffect(() => {
    if (!watching) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenIslandOutsideClick(() => handlerRef.current())
      .then((stop) => (cancelled ? stop() : (unlisten = stop)))
      .catch(report);
    void setIslandOutsideClickWatch(true).catch(report);
    return () => {
      cancelled = true;
      unlisten?.();
      void setIslandOutsideClickWatch(false).catch(report);
    };
  }, [watching]);
}
