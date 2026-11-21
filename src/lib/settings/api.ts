import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

export function saveThemeFile(fileName: string, content: string) {
  return invoke<string>("save_settings_backup", { fileName, content });
}

export function getWindowsAccentColor() {
  return invoke<string | null>("get_windows_accent_color");
}

export function revealThemeFile(path: string) {
  return revealItemInDir(path);
}

export type IslandDockEdge = "top" | "left" | "right" | "bottom";

export type IslandDockTarget = IslandDockEdge | "taskbar";

export type IslandTaskbar = { docked: boolean; placed: boolean };

const ISLAND_EDGE_CHANGED_EVENT = "island-edge-changed";

const ISLAND_TASKBAR_CHANGED_EVENT = "island-taskbar-changed";

export function getIslandDockEdge() {
  return invoke<IslandDockEdge | null>("get_island_edge");
}

export function listenIslandDockEdge(handler: (edge: IslandDockEdge | null) => void): Promise<UnlistenFn> {
  return listen<IslandDockEdge | null>(ISLAND_EDGE_CHANGED_EVENT, ({ payload }) => handler(payload));
}

export function getIslandTaskbar() {
  return invoke<IslandTaskbar>("get_island_taskbar");
}

export function listenIslandTaskbar(handler: (taskbar: IslandTaskbar) => void): Promise<UnlistenFn> {
  return listen<IslandTaskbar>(ISLAND_TASKBAR_CHANGED_EVENT, ({ payload }) => handler(payload));
}

export function dockIslandTo(edge: Exclude<IslandDockTarget, "top">) {
  return invoke<void>("set_island_edge", { edge });
}

export type WallpaperFit = "fill" | "fit" | "stretch" | "center" | "tile" | "span";

export type MonitorWallpaper = { x: number; y: number; width: number; height: number; image: string | null };

export type Wallpapers = { fit: WallpaperFit; color: string; monitors: MonitorWallpaper[] };

const WALLPAPER_CHANGED_EVENT = "wallpaper-changed";

export function getWallpapers() {
  return invoke<Wallpapers | null>("get_wallpapers");
}

export function listenWallpaperChanged(handler: () => void): Promise<UnlistenFn> {
  return listen(WALLPAPER_CHANGED_EVENT, () => handler());
}
