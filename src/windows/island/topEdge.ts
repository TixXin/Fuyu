import { isTauri } from "@tauri-apps/api/core";
import { getIslandEdge, listenIslandEdge, type IslandEdge } from "./api.ts";
import "./IslandTopEdge.css";
import "./IslandBottomEdge.css";
import "./IslandTaskbar.css";
import { getIslandTaskbar, listenIslandTaskbar, type IslandTaskbar } from "../../lib/settings/api";

function applyEdge(edge: IslandEdge | null) {
  document.documentElement.dataset.islandTopEdge = edge === "top" ? "attached" : "detached";
  document.documentElement.dataset.islandEdge = edge ?? "none";
}

function applyTaskbar(taskbar: IslandTaskbar | null) {
  document.documentElement.dataset.islandTaskbar = taskbar?.docked && taskbar.placed ? "placed" : "none";
}

export function trackIslandTopEdge() {
  if (!isTauri()) return;

  void listenIslandTaskbar(applyTaskbar)
    .then(() => getIslandTaskbar())
    .then(applyTaskbar)
    .catch((error) => {
      console.error("Failed to track the island on the taskbar", error);
    });

  void listenIslandEdge(applyEdge)
    .then(() => getIslandEdge())
    .then(applyEdge)
    .catch((error) => {
      console.error("Failed to track the island top edge", error);
    });
}
