import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type EventCallback } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { PixelRect } from "./selection";

/** Mirrored by SESSION_EVENT in src-tauri/src/screenshot/session.rs. */
export const SCREENSHOT_SESSION_EVENT = "screenshot-session";
/** Mirrored by ENDED_EVENT in src-tauri/src/screenshot/session.rs. */
export const SCREENSHOT_ENDED_EVENT = "screenshot-ended";
/** Between the overlays only: one started a selection, so the others drop theirs. */
export const SCREENSHOT_SELECTING_EVENT = "screenshot-selecting";

// 与 src-tauri/src/screenshot/session.rs 中的 Mode 对应。
export type ScreenshotMode = "region" | "fullscreen";

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

export function screenshotOverlayReady(session: number) {
  return invoke<void>("screenshot_overlay_ready", { session });
}

/** Copies `rect` of this overlay's picture and closes the screenshot. */
export function copyScreenshot(rect: PixelRect) {
  return invoke<void>("screenshot_copy", { rect });
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
