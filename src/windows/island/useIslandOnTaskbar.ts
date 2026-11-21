import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getIslandTaskbar, listenIslandTaskbar, type IslandTaskbar } from "../../lib/settings/api";

export type IslandOnTaskbar = { placed: boolean; light: boolean; lift: number; roomLeft: number; roomRight: number };

const OFF: IslandOnTaskbar = { placed: false, light: false, lift: 0, roomLeft: 0, roomRight: 0 };

function size(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function same(a: IslandOnTaskbar, b: IslandOnTaskbar): boolean {
  return a.placed === b.placed && a.light === b.light && a.lift === b.lift && a.roomLeft === b.roomLeft && a.roomRight === b.roomRight;
}

function read(taskbar: IslandTaskbar | null): IslandOnTaskbar {
  if (taskbar?.docked !== true || !taskbar.placed) return OFF;
  return { placed: true, light: taskbar.light === true, lift: size(taskbar.lift), roomLeft: size(taskbar.roomLeft), roomRight: size(taskbar.roomRight) };
}

export function useIslandOnTaskbar(): IslandOnTaskbar {
  const [onTaskbar, setOnTaskbar] = useState(OFF);

  useEffect(() => {
    if (!isTauri()) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    const apply = (next: IslandTaskbar | null) => {
      const value = read(next);
      setOnTaskbar((current) => (same(current, value) ? current : value));
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
