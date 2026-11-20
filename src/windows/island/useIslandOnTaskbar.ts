import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getIslandTaskbar, listenIslandTaskbar } from "../../lib/settings/api";

export function useIslandOnTaskbar() {
  const [onTaskbar, setOnTaskbar] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenIslandTaskbar((next) => setOnTaskbar(next?.docked === true && next.placed))
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
        return getIslandTaskbar().then((next) => {
          if (!didCancel) setOnTaskbar(next?.docked === true && next.placed);
        });
      })
      .catch((error) => {
        console.error("Failed to track the island on the taskbar", error);
      });
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  return onTaskbar;
}
