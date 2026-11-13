import { isTauri } from "@tauri-apps/api/core";
import { getIslandEdge, listenIslandEdge, type IslandEdge } from "./api.ts";
import "./IslandTopEdge.css";

function applyEdge(edge: IslandEdge | null) {
  document.documentElement.dataset.islandTopEdge = edge === "top" ? "attached" : "detached";
  document.documentElement.dataset.islandEdge = edge ?? "none";
}

export function trackIslandTopEdge() {
  if (!isTauri()) return;

  void listenIslandEdge(applyEdge)
    .then(() => getIslandEdge())
    .then(applyEdge)
    .catch((error) => {
      console.error("Failed to track the island top edge", error);
    });
}
