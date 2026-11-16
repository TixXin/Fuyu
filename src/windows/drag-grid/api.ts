import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const DRAG_GRID_STATE_EVENT = "drag-grid-state";

export type DragGridEdge = "top" | "bottom" | "left" | "right";

export type DragGridState = {
  visible: boolean;
  lines: boolean;
  snap: DragGridEdge | null;
};

export const HIDDEN_DRAG_GRID: DragGridState = { visible: false, lines: true, snap: null };

export function getDragGridState() {
  return invoke<DragGridState>("get_drag_grid_state");
}

export function listenDragGridState(handler: (state: DragGridState) => void): Promise<UnlistenFn> {
  return listen<DragGridState>(DRAG_GRID_STATE_EVENT, ({ payload }) => handler(payload));
}
