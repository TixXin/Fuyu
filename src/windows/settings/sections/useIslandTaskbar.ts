import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getIslandTaskbar, listenIslandTaskbar, type IslandTaskbar } from "../../../lib/settings/api";
import { getTaskbarLayout } from "../../../lib/taskbar/api";

const NOT_DOCKED: IslandTaskbar = { docked: false, placed: false };

export function useIslandTaskbar() {
  const [taskbar, setTaskbar] = useState<IslandTaskbar>(NOT_DOCKED);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let didCancel = false;
    void getTaskbarLayout()
      .then((bars) => {
        if (!didCancel) setAvailable(Array.isArray(bars) && bars.some((bar) => bar.edge === "bottom"));
      })
      .catch(() => undefined);
    return () => {
      didCancel = true;
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenIslandTaskbar((next) => setTaskbar(next ?? NOT_DOCKED))
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
        return getIslandTaskbar().then((next) => {
          if (!didCancel) setTaskbar(next ?? NOT_DOCKED);
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

  return { ...taskbar, available: available || taskbar.docked };
}
