import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type EventCallback } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { PixelRect } from "./selection";
import type { Target } from "./targets";

/** Mirrored by SESSION_EVENT in src-tauri/src/screenshot/session.rs. */
export const SCREENSHOT_SESSION_EVENT = "screenshot-session";
/** Mirrored by ENDED_EVENT in src-tauri/src/screenshot/session.rs. */
export const SCREENSHOT_ENDED_EVENT = "screenshot-ended";
/** Mirrored by TARGETS_EVENT in src-tauri/src/screenshot/targets.rs; the payload is the session id. */
export const SCREENSHOT_TARGETS_EVENT = "screenshot-targets";
/** Between the overlays only: one started a selection, so the others drop theirs. */
export const SCREENSHOT_SELECTING_EVENT = "screenshot-selecting";

// 与 src-tauri/src/screenshot/session.rs 中的 Mode 对应。
export type ScreenshotMode = "region" | "copy" | "fullscreen";

// 与 src-tauri/src/screenshot/session.rs 中的 OverlaySession 对应。
export type ScreenshotSession = {
  id: number;
  mode: ScreenshotMode;
  /** The monitor picture's size in physical pixels. */
  width: number;
  height: number;
  /** This overlay's monitor has the pointer: it has the keyboard and the whole-monitor selection. */
  underPointer: boolean;
};

/** Turns the screenshot shortcuts on or off (the module switch). */
export function configureScreenshot(enabled: boolean) {
  return invoke<void>("screenshot_configure", { enabled });
}

/** The open screenshot as this overlay shows it, or null. */
export function getScreenshotSession() {
  return invoke<ScreenshotSession | null>("screenshot_session");
}

/** This overlay's monitor picture: RGBA rows, `width` × `height` from the session. */
export function getScreenshotFrame() {
  return invoke<ArrayBuffer>("screenshot_frame");
}

/** What this overlay can snap to: windows, then controls once they are read. */
export function getScreenshotTargets() {
  return invoke<Target[]>("screenshot_targets");
}

export function listenScreenshotTargets(handler: EventCallback<number>) {
  return listen<number>(SCREENSHOT_TARGETS_EVENT, handler);
}

export function screenshotOverlayReady(session: number) {
  return invoke<void>("screenshot_overlay_ready", { session });
}

/** What to do with the chosen picture (mirrored by Action in src-tauri/src/screenshot/mod.rs). */
export type ScreenshotAction = "copy" | "save" | "pin";

/** Where a save goes: the folder from the settings (none yet: Pictures) and the default subfolder's name. */
export type SaveTarget = { folder?: string; folderName: string };

function rawBytes(image: ImageData) {
  return new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
}

/**
 * Takes the picture this overlay composed (the selection with its annotations) to the clipboard, a
 * file or a pin, and closes the screenshot; a failed copy or save leaves it open. The pixels go
 * as raw RGBA, not JSON; `at` is where the selection is in the monitor's picture (for a pin).
 * Gives the saved file's path when saving.
 */
export function finishScreenshot(image: ImageData, at: PixelRect, action: ScreenshotAction, save?: SaveTarget) {
  const headers: Record<string, string> = {
    "x-action": action,
    "x-width": String(image.width),
    "x-height": String(image.height),
    "x-left": String(Math.max(0, Math.round(at.x))),
    "x-top": String(Math.max(0, Math.round(at.y))),
  };
  // Header values must be ASCII; folder names need not be.
  if (save?.folder) headers["x-folder"] = encodeURIComponent(save.folder);
  if (save) headers["x-folder-name"] = encodeURIComponent(save.folderName);
  return invoke<string | null>("screenshot_finish", rawBytes(image), { headers });
}

export function cancelScreenshot() {
  return invoke<void>("screenshot_cancel");
}

export function listenScreenshotSession(handler: EventCallback<ScreenshotSession>) {
  return listen<ScreenshotSession>(SCREENSHOT_SESSION_EVENT, handler);
}

export function listenScreenshotEnded(handler: EventCallback<unknown>) {
  return listen(SCREENSHOT_ENDED_EVENT, handler);
}

/** This overlay window's label, `screenshot-<monitor>`. */
export function overlayLabel() {
  return getCurrentWebviewWindow().label;
}

export function announceSelecting(label: string) {
  return emit(SCREENSHOT_SELECTING_EVENT, label);
}

export function listenSelecting(handler: EventCallback<string>) {
  return listen<string>(SCREENSHOT_SELECTING_EVENT, handler);
}

/** The calling pin's picture: RGBA rows, its size in the page's URL. */
export function getPinImage() {
  return invoke<ArrayBuffer>("screenshot_pin_image");
}

export function pinReady() {
  return invoke<void>("screenshot_pin_ready");
}

/** Zooms the pin to `scale` of its picture, keeping `anchor` (fractions of the window) in place. */
export function zoomPin(scale: number, anchor: { x: number; y: number }) {
  return invoke<void>("screenshot_pin_zoom", { scale, anchorX: anchor.x, anchorY: anchor.y });
}

export function setPinClickThrough(through: boolean) {
  return invoke<void>("screenshot_pin_click_through", { through });
}

export function copyPin() {
  return invoke<void>("screenshot_pin_copy");
}

/** Saves the pin's picture; gives the file's path. */
export function savePin(target: SaveTarget) {
  return invoke<string>("screenshot_pin_save", { folder: target.folder ?? null, folderName: target.folderName });
}

export function closePin() {
  return invoke<void>("screenshot_pin_close");
}

/** Hides every pin, or shows them all again (T). */
export function togglePins() {
  return invoke<void>("screenshot_pins_toggle");
}

export function closeAllPins() {
  return invoke<void>("screenshot_pins_close_all");
}
