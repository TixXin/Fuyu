import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getIslandEdge, listenIslandEdge, type IslandEdge } from "./api.ts";

export type IslandSide = Exclude<IslandEdge, "top">;

function sideOf(edge: IslandEdge | null): IslandSide | null {
  return edge === "left" || edge === "right" ? edge : null;
}

export function useIslandSide() {
  const [side, setSide] = useState<IslandSide | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenIslandEdge((edge) => setSide(sideOf(edge)))
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
        return getIslandEdge().then((edge) => {
          if (!didCancel) setSide(sideOf(edge));
        });
      })
      .catch((error) => {
        console.error("Failed to track the island side", error);
      });
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  return side;
}
