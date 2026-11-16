import { useEffect, useLayoutEffect, useRef } from "react";
import { listenShortcutCaptured, setShortcutCapture } from "./api";

function logCaptureError(error: unknown) {
  console.error("Failed to switch shortcut capture", error);
}

export function useShortcutCapture(active: boolean, onCaptured: (shortcut: string) => void) {
  const latest = useRef(onCaptured);
  useLayoutEffect(() => {
    latest.current = onCaptured;
  });

  useEffect(() => {
    if (!active) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenShortcutCaptured((shortcut) => latest.current(shortcut))
      .then((nextUnlisten) => {
        if (didCancel) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch(logCaptureError);
    void setShortcutCapture(true).catch(logCaptureError);
    return () => {
      didCancel = true;
      unlisten?.();
      void setShortcutCapture(false).catch(logCaptureError);
    };
  }, [active]);
}
