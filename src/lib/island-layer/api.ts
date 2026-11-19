import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const ISLAND_LAYER_EVENT = "island-layer-changed";
export const ISLAND_LAYER_SHORTCUT_STATUS_EVENT = "island-layer-shortcut-status";

export type IslandLayerShortcutProblem = "invalid" | "taken";

export function setIslandLayerShortcut(shortcut: string | null) {
  return invoke<void>("set_island_layer_shortcut", { shortcut });
}

export function getIslandLayerShortcutProblem() {
  return invoke<IslandLayerShortcutProblem | null>("get_island_layer_shortcut_problem");
}

export function listenIslandLayerShortcutProblem(handler: (problem: IslandLayerShortcutProblem | null) => void): Promise<UnlistenFn> {
  return listen<IslandLayerShortcutProblem | null>(ISLAND_LAYER_SHORTCUT_STATUS_EVENT, ({ payload }) => handler(payload));
}

export function getIslandLayer() {
  return invoke<boolean>("get_island_layer");
}

export function toggleIslandLayer() {
  return invoke<boolean>("toggle_island_layer");
}

export function listenIslandLayer(handler: (front: boolean) => void): Promise<UnlistenFn> {
  return listen<boolean>(ISLAND_LAYER_EVENT, ({ payload }) => handler(payload));
}
