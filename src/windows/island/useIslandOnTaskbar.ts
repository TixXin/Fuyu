import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getIslandTaskbar, listenIslandTaskbar, type IslandTaskbar } from "../../lib/settings/api";

export type IslandOnTaskbar = { placed: boolean; light: boolean };

const OFF: IslandOnTaskbar = { placed: false, light: false };

function read(taskbar: IslandTaskbar | null): IslandOnTaskbar {
  return taskbar?.docked === true && taskbar.placed ? { placed: true, light: taskbar.light === true } : OFF;
}

export function useIslandOnTaskbar(): IslandOnTaskbar {
  const [onTaskbar, setOnTaskbar] = useState(OFF);

  useEffect(() => {
    if (!isTauri()) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    const apply = (next: IslandTaskbar | null) => {
      const value = read(next);
      setOnTaskbar((current) => (current.placed === value.placed && current.light === value.light ? current : value));
    };
    void listenIslandTaskbar(apply)
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
        return getIslandTaskbar().then((next) => {
          if (!didCancel) apply(next);
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
