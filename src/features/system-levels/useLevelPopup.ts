import { useEffect, useRef, useState } from "react";
import { listenLevelChanges, setLevelPopupEnabled, type LevelChange } from "./api";

export const LEVEL_POPUP_MS = 1500;

export function useLevelPopup(watch: boolean, show: boolean): LevelChange | null {
  const [change, setChange] = useState<LevelChange | null>(null);
  const showRef = useRef(show);
  showRef.current = show;

  useEffect(() => {
    void setLevelPopupEnabled(watch).catch((error: unknown) =>
      console.error("Failed to switch the volume and brightness watcher", error),
    );
    if (!watch) {
      setChange(null);
      return;
    }
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenLevelChanges((next) => {
      if (showRef.current) setChange(next);
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for volume and brightness changes", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [watch]);

  useEffect(() => {
    if (!show) setChange(null);
  }, [show]);

  useEffect(() => {
    if (!change) return;
    const timer = window.setTimeout(() => setChange(null), LEVEL_POPUP_MS);
    return () => window.clearTimeout(timer);
  }, [change]);

  return change;
}
