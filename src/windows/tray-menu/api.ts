import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const TRAY_MENU_OPEN_EVENT = "tray-menu-open";
export const TRAY_MENU_STATE_EVENT = "tray-menu-state";

export type TrayMenuState = {
  islandVisible: boolean;
  islandBehind: boolean;
  clipboardPaused: boolean;
  translateEnabled: boolean;
  screenshotEnabled: boolean;
  version: string;
  updateAvailable: string | null;
  platform: "windows" | "macos";
};

export type IslandMenuRow = { id: string; name: string; shown: boolean };

export type TrayMenuPage = "todo" | "notes" | "calendar" | "file-shelf" | "agent";

export type TrayMenuAction =
  | "toggle_island"
  | "raise_island"
  | "screenshot"
  | "screenshot_delayed"
  | "translate"
  | "clipboard"
  | "toggle_clipboard_pause"
  | "open_page"
  | "open_settings"
  | "update"
  | "restart"
  | "quit"
  | "close";

export function getTrayMenuState() {
  return invoke<TrayMenuState>("tray_menu_state");
}

export function trayMenuAction(action: TrayMenuAction, arg?: string) {
  return invoke("tray_menu_action", { action, arg: arg ?? null });
}

export function resizeTrayMenu(width: number, height: number) {
  return invoke("tray_menu_resize", { width, height });
}

export function listenTrayMenuOpen(handler: (islandRows: IslandMenuRow[] | null) => void) {
  return listen<IslandMenuRow[] | null>(TRAY_MENU_OPEN_EVENT, ({ payload }) => handler(payload ?? null));
}

export function getIslandMenuRows() {
  return invoke<IslandMenuRow[] | null>("island_menu_rows");
}

export function islandMenuAction(action: "toggle" | "arrange" | "resize", id?: string) {
  return invoke("island_menu_action", { action, id: id ?? null });
}

export function listenTrayMenuState(handler: (state: TrayMenuState) => void) {
  return listen<TrayMenuState>(TRAY_MENU_STATE_EVENT, ({ payload }) => handler(payload));
}
