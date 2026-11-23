import { useMemo, type Dispatch, type SetStateAction } from "react";
import { islandMenuAction, trayMenuAction, type IslandMenuRow } from "./api";
import type { IslandMenuHandlers } from "./IslandMenuCard";

function send(action: "toggle" | "arrange" | "resize", id?: string) {
  void islandMenuAction(action, id).catch((error: unknown) => console.error(`Island menu action ${action} failed`, error));
}

export function useIslandMenuHandlers(setRows: Dispatch<SetStateAction<IslandMenuRow[] | null>>) {
  return useMemo<IslandMenuHandlers>(() => ({
    onToggle: (id) => {
      setRows((rows) => rows && rows.map((row) => (row.id === id ? { ...row, shown: !row.shown } : row)));
      send("toggle", id);
    },
    onArrange: () => send("arrange"),
    onResize: () => send("resize"),
    onClose: () => void trayMenuAction("close").catch((error: unknown) => console.error("Failed to close the island menu", error)),
  }), [setRows]);
}
