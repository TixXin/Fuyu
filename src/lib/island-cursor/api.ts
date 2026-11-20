import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const ISLAND_CURSOR_MOVED_EVENT = "island-cursor-moved";
const ISLAND_WINDOW_LABEL = "main";

export type CursorPoint = { x: number; y: number };

let cursorUsers = 0;

export function canTrackIslandCursor(): boolean {
  try {
    return getCurrentWindow().label === ISLAND_WINDOW_LABEL;
  } catch {
    return false;
  }
}

export function acquireIslandCursor(): void {
  cursorUsers += 1;
  if (cursorUsers === 1) void invoke("set_island_cursor_tracking", { enabled: true }).catch(() => undefined);
}

export function releaseIslandCursor(): void {
  if (cursorUsers === 0) return;
  cursorUsers -= 1;
  if (cursorUsers === 0) void invoke("set_island_cursor_tracking", { enabled: false }).catch(() => undefined);
}

export function listenIslandCursor(handler: (point: CursorPoint) => void): Promise<UnlistenFn> {
  return listen<CursorPoint>(ISLAND_CURSOR_MOVED_EVENT, ({ payload }) => handler(payload));
}
