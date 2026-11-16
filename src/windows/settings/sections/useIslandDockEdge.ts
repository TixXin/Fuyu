import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getIslandDockEdge, listenIslandDockEdge, type IslandDockEdge } from "../../../lib/settings/api";

export function useIslandDockEdge() {
  const [edge, setEdge] = useState<IslandDockEdge | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenIslandDockEdge((next) => setEdge(next))
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
        return getIslandDockEdge().then((next) => {
          if (!didCancel) setEdge(next);
        });
      })
      .catch((error) => {
        console.error("Failed to track the island edge", error);
      });
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  return edge;
}
