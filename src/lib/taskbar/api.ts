import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { UnlistenFn } from "@tauri-apps/api/event";

export type Rect = { left: number; top: number; right: number; bottom: number };

export type BarEdge = "bottom" | "top" | "left" | "right";

export type TaskbarLayout = {
  primary: boolean;
  edge: BarEdge;
  hidden: boolean;
  autoHide: boolean;
  rect: Rect;
  monitor: Rect;
  free: Rect[];
};

export type DockStatus = "shown" | "barHidden" | "fullscreen" | "noRoom" | "noTaskbar";

export type DockState = {
  status: DockStatus;
  rect: Rect | null;
  edge: BarEdge | null;
};

const TASKBAR_DOCK_CHANGED_EVENT = "taskbar-dock-changed";

export function getTaskbarLayout() {
  return invoke<TaskbarLayout[]>("get_taskbar_layout");
}

export function dockToTaskbar(width: number, order?: number) {
  return invoke<void>("taskbar_dock", { width, order });
}

export function undockFromTaskbar() {
  return invoke<void>("taskbar_undock");
}

export function listenTaskbarDock(handler: (state: DockState) => void): Promise<UnlistenFn> {
  return getCurrentWebviewWindow().listen<DockState>(TASKBAR_DOCK_CHANGED_EVENT, ({ payload }) => handler(payload));
}
