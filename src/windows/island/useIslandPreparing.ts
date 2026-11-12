import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";

export function useIslandPreparing(isExpanded: boolean) {
  const [isPreparing, setIsPreparing] = useState(isTauri);

  useEffect(() => {
    if (!isPreparing) {
      return;
    }
    if (isExpanded) {
      setIsPreparing(false);
      return;
    }

    let didCancel = false;
    let frame: number | null = null;
    let timer: number | null = null;
    void document.fonts.ready.then(() => {
      if (didCancel) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          timer = window.setTimeout(() => setIsPreparing(false), 180);
        });
      });
    });

    return () => {
      didCancel = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [isExpanded, isPreparing]);

  return isPreparing;
}
