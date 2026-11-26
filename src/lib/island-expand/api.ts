import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const ISLAND_EXPAND_SHORTCUT_EVENT = "island-expand-shortcut";
export const ISLAND_EXPAND_SHORTCUT_STATUS_EVENT = "island-expand-shortcut-status";

export type IslandExpandShortcutProblem = "invalid" | "taken";

export function setIslandExpandShortcut(shortcut: string | null) {
  return invoke<void>("set_island_expand_shortcut", { shortcut });
}

export function getIslandExpandShortcutProblem() {
  return invoke<IslandExpandShortcutProblem | null>("get_island_expand_shortcut_problem");
}

export function listenIslandExpandShortcut(handler: () => void): Promise<UnlistenFn> {
  return listen(ISLAND_EXPAND_SHORTCUT_EVENT, () => handler());
}

export function listenIslandExpandShortcutProblem(handler: (problem: IslandExpandShortcutProblem | null) => void): Promise<UnlistenFn> {
  return listen<IslandExpandShortcutProblem | null>(ISLAND_EXPAND_SHORTCUT_STATUS_EVENT, ({ payload }) => handler(payload));
}
