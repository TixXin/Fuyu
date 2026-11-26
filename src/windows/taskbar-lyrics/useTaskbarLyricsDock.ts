import { useEffect, useState } from "react";
import { dockToTaskbar, listenTaskbarDock, undockFromTaskbar, type DockState } from "../../lib/taskbar/api";
import { showTaskbarLyrics } from "../../features/media/taskbar/api";

const LYRICS_ORDER = 1;

export function useTaskbarLyricsDock(width: number | null): DockState | null {
  const [dock, setDock] = useState<DockState | null>(null);
  const dockWidth = width ?? 0;

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenTaskbarDock(setDock)
      .then((nextUnlisten) => {
        if (didCancel) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch((error) => console.error("Failed to follow the taskbar", error));
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (dockWidth > 0) {
      void dockToTaskbar(dockWidth, LYRICS_ORDER).catch((error) => console.error("Failed to put the lyrics on the taskbar", error));
      return;
    }
    void undockFromTaskbar()
      .then(() => setDock(null))
      .catch(() => undefined);
  }, [dockWidth]);

  const shown = width !== null && dock?.status === "shown" && dock.edge !== null && (dock.edge === "bottom" || dock.edge === "top");
  useEffect(() => {
    void showTaskbarLyrics(shown).catch(() => undefined);
  }, [shown]);

  return dock;
}
