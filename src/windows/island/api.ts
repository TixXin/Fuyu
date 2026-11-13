import { invoke } from "@tauri-apps/api/core";
import { listen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { IslandCornerShape, IslandMonitor } from "../../features/appearance/types";
import type { IslandPosition } from "./storage";
import type { IslandMode, NativeGlassState } from "./types";

export const TOP_ATTACHMENT_CHANGED_EVENT = "island-top-attachment-changed";

export function getIslandTopAttachment(): Promise<boolean> {
  return invoke<boolean>("get_island_top_attachment");
}

export function listenIslandTopAttachment(
  handler: (attached: boolean) => void,
): Promise<UnlistenFn> {
  return listen<boolean>(TOP_ATTACHMENT_CHANGED_EVENT, ({ payload }) => handler(payload));
}

export type IslandEdge = "top" | "left" | "right";

export const ISLAND_EDGE_CHANGED_EVENT = "island-edge-changed";

export function getIslandEdge(): Promise<IslandEdge | null> {
  return invoke<IslandEdge | null>("get_island_edge");
}

export function listenIslandEdge(
  handler: (edge: IslandEdge | null) => void,
): Promise<UnlistenFn> {
  return listen<IslandEdge | null>(ISLAND_EDGE_CHANGED_EVENT, ({ payload }) => handler(payload));
}

export const ISLAND_HOVER_CHANGED_EVENT = "island-hover-changed";

export function listenIslandHover(
  handler: (inside: boolean) => void,
): Promise<UnlistenFn> {
  return listen<boolean>(ISLAND_HOVER_CHANGED_EVENT, ({ payload }) => handler(payload));
}

export const ISLAND_REVEAL_REQUESTED_EVENT = "island-reveal-requested";

export function listenIslandRevealRequested(handler: () => void): Promise<UnlistenFn> {
  return listen(ISLAND_REVEAL_REQUESTED_EVENT, () => handler());
}

export const ISLAND_MOVE_ARMED_CHANGED_EVENT = "island-move-armed-changed";

export type IslandModifierTarget = "none" | "move" | "left" | "right" | "bottom" | "bottomLeft" | "bottomRight";

export function listenIslandMoveArmed(
  handler: (target: IslandModifierTarget) => void,
): Promise<UnlistenFn> {
  return listen<IslandModifierTarget>(ISLAND_MOVE_ARMED_CHANGED_EVENT, ({ payload }) => handler(payload));
}

const ISLAND_HOLD_CHANGED_EVENT = "island-hold-changed";

export function listenIslandHold(handler: (held: boolean) => void): Promise<UnlistenFn> {
  return listen<boolean>(ISLAND_HOLD_CHANGED_EVENT, ({ payload }) => handler(payload));
}

const ISLAND_RESIZE_EVENT = "island-resize";

export type IslandResizeDelta = { width: number; height: number; collapsed: boolean; done: boolean };

export function setIslandPanelResizable(resizable: boolean): Promise<void> {
  return invoke("set_island_panel_resizable", { resizable });
}

export function listenIslandResize(handler: (delta: IslandResizeDelta) => void): Promise<UnlistenFn> {
  return listen<IslandResizeDelta>(ISLAND_RESIZE_EVENT, ({ payload }) => handler(payload));
}

export const ISLAND_POSITION_CHANGED_EVENT = "island-position-changed";

export type IslandLayout = { collapsedScale: number; expandedScale: number; marginY: number; underMenuBar: boolean };

export type IslandInteraction = {
  mode: IslandMode;
  collapsedScale: number;
  expandedScale: number;
  marginY: number;
  expandedHeight: number;
  expandedWidth: number;
  collapsedWidth: number;
  customPosition: IslandPosition | null;
  isTucked: boolean;
  animatePosition: boolean;
  glassEnabled: boolean;
  glassIntensity: number;
  glassTint: string;
  cornerRadius: number;
  cornerShape: IslandCornerShape;
  monitorFollow: IslandMonitor;
};

export function setIslandLayout(layout: IslandLayout) {
  return invoke("set_island_layout", { layout });
}

export function setIslandInteraction(interaction: IslandInteraction) {
  return invoke<NativeGlassState>("set_island_interaction", interaction);
}

export function showReadyIsland() {
  return invoke("show_ready_island");
}

export function minimizeIsland() {
  return invoke("minimize_island");
}

export function takeIslandHoverFocus() {
  return invoke<boolean>("take_island_hover_focus");
}

export function releaseIslandHoverFocus() {
  return invoke<boolean>("release_island_hover_focus");
}

export function islandIsForeground() {
  return invoke<boolean>("island_is_foreground");
}

export function listenIslandFocus(handler: (focused: boolean) => void): Promise<UnlistenFn> {
  return getCurrentWindow().onFocusChanged(({ payload }) => handler(payload));
}

export const FOREGROUND_FULLSCREEN_CHANGED_EVENT = "foreground-fullscreen-changed";

export type ForegroundFullscreen = {
  active: boolean;
  onIslandMonitor: boolean;
};

export function getForegroundFullscreen() {
  return invoke<ForegroundFullscreen>("get_foreground_fullscreen");
}

export function listenForegroundFullscreen(handler: (state: ForegroundFullscreen) => void): Promise<UnlistenFn> {
  return listen<ForegroundFullscreen>(FOREGROUND_FULLSCREEN_CHANGED_EVENT, ({ payload }) => handler(payload));
}

export function startIslandDrag() {
  return invoke("start_island_drag");
}

export function startIslandModifierDrag() {
  return invoke("start_island_modifier_drag");
}

export function resetIslandPosition() {
  return invoke("reset_island_position");
}

export function listenIslandPositionChanged(handler: EventCallback<IslandPosition>) {
  return listen<IslandPosition>(ISLAND_POSITION_CHANGED_EVENT, handler);
}

export const ISLAND_POSITION_CLEARED_EVENT = "island-position-cleared";

export function listenIslandPositionCleared(handler: EventCallback<null>) {
  return listen<null>(ISLAND_POSITION_CLEARED_EVENT, handler);
}

export const OUTSIDE_CLICK_EVENT = "island-outside-click";

export function setIslandOutsideClickWatch(watch: boolean) {
  return invoke<void>("set_island_outside_click_watch", { watch });
}

export function listenIslandOutsideClick(handler: () => void) {
  return listen<null>(OUTSIDE_CLICK_EVENT, () => handler());
}

export function setTrayLanguage(locale: string) {
  return invoke<void>("set_tray_language", { locale });
}

export type IslandBannerRect = { x: number; y: number; width: number; height: number };

export function setIslandBannerRect(rect: IslandBannerRect | null) {
  return invoke<void>("set_island_banner_rect", { rect });
}

export const ISLAND_BANNER_HOVER_CHANGED_EVENT = "island-banner-hover-changed";

export function listenIslandBannerHover(handler: (inside: boolean) => void): Promise<UnlistenFn> {
  return listen<boolean>(ISLAND_BANNER_HOVER_CHANGED_EVENT, ({ payload }) => handler(payload));
}
