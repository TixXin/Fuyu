import { isTauri } from "@tauri-apps/api/core";
import { getIslandTopAttachment, listenIslandTopAttachment } from "./api.ts";
import "./IslandTopEdge.css";

function applyTopEdge(attached: boolean) {
  document.documentElement.dataset.islandTopEdge = attached ? "attached" : "detached";
}

export function trackIslandTopEdge() {
  if (!isTauri()) return;

  void listenIslandTopAttachment(applyTopEdge)
    .then(() => getIslandTopAttachment())
    .then(applyTopEdge)
    .catch((error) => {
      console.error("Failed to track the island top edge", error);
    });
}
