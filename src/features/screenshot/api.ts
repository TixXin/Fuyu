import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type EventCallback } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { OcrWord } from "./redact";
import type { PixelRect } from "./selection";
import { shortcutConfig, type ScreenshotSettings, type ShortcutAction } from "./settings";
import type { Target } from "./targets";

export const SCREENSHOT_SESSION_EVENT = "screenshot-session";
export const SCREENSHOT_ENDED_EVENT = "screenshot-ended";
export const SCREENSHOT_TARGETS_EVENT = "screenshot-targets";
export const SCREENSHOT_SELECTING_EVENT = "screenshot-selecting";
export const PIN_ASSIGNED_EVENT = "screenshot-pin-assigned";
export const SCREENSHOT_TAKEN_EVENT = "screenshot-taken";
export const SCREENSHOT_TEXT_EVENT = "screenshot-text";

export type ScreenshotMode = "region" | "copy" | "text" | "translate" | "long" | "fullscreen";

export type ScreenshotSession = {
  id: number;
  mode: ScreenshotMode;
  width: number;
  height: number;
  underPointer: boolean;
};

export const SCREENSHOT_SHORTCUT_STATUS_EVENT = "screenshot-shortcut-status";

export type ShortcutStatus = { action: ShortcutAction; problem: "invalid" | "duplicate" | "taken" };

export function configureScreenshot(enabled: boolean, settings: ScreenshotSettings) {
  return invoke<void>("screenshot_configure", { enabled, shortcuts: shortcutConfig(settings), printScreen: settings.printScreen, historyDays: settings.historyDays });
}

export function getScreenshotShortcutStatus() {
  return invoke<ShortcutStatus[]>("screenshot_shortcut_status");
}

export function listenScreenshotShortcutStatus(handler: EventCallback<ShortcutStatus[]>) {
  return listen<ShortcutStatus[]>(SCREENSHOT_SHORTCUT_STATUS_EVENT, handler);
}

export function startScreenshot(mode: ScreenshotMode) {
  return invoke<void>("screenshot_start", { mode });
}

export function getScreenshotSession() {
  return invoke<ScreenshotSession | null>("screenshot_session");
}

export function getScreenshotFrame() {
  return invoke<ArrayBuffer>("screenshot_frame");
}

export function getScreenshotTargets() {
  return invoke<Target[]>("screenshot_targets");
}

export function listenScreenshotTargets(handler: EventCallback<number>) {
  return listen<number>(SCREENSHOT_TARGETS_EVENT, handler);
}

export function screenshotOverlayReady(session: number) {
  return invoke<void>("screenshot_overlay_ready", { session });
}

export type ScreenshotAction = "copy" | "save" | "pin" | "text" | "translate" | "long";

export type QuickAction = Extract<ScreenshotAction, "copy" | "text" | "translate" | "long">;

export function quickAction(mode: ScreenshotMode | undefined): QuickAction | null {
  return mode === "copy" || mode === "text" || mode === "translate" || mode === "long" ? mode : null;
}

export type SaveTarget = { folder?: string; folderName: string };

function rawBytes(image: ImageData) {
  return new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
}

export type ScreenshotPatch = { at: PixelRect; image: ImageData };

export function finishScreenshot(selection: PixelRect, patch: ScreenshotPatch | null, action: ScreenshotAction, save?: SaveTarget) {
  const whole = (value: number) => String(Math.max(0, Math.round(value)));
  const headers: Record<string, string> = {
    "x-action": action,
    "x-left": whole(selection.x),
    "x-top": whole(selection.y),
    "x-width": whole(selection.width),
    "x-height": whole(selection.height),
  };
  if (patch) {
    headers["x-patch-left"] = whole(patch.at.x - selection.x);
    headers["x-patch-top"] = whole(patch.at.y - selection.y);
    headers["x-patch-width"] = String(patch.image.width);
    headers["x-patch-height"] = String(patch.image.height);
  }
  if (save?.folder) headers["x-folder"] = encodeURIComponent(save.folder);
  if (save) headers["x-folder-name"] = encodeURIComponent(save.folderName);
  return invoke<string | null>("screenshot_finish", patch ? rawBytes(patch.image) : new Uint8Array(0), { headers });
}

export function cancelScreenshot() {
  return invoke<void>("screenshot_cancel");
}

export const SCREENSHOT_LONG_EVENT = "screenshot-long";
export const SCREENSHOT_LONG_PROGRESS_EVENT = "screenshot-long-progress";

export type LongState = "ready" | "scrolling" | "paused" | "end" | "fast" | "full";
export type LongProgress = { state: LongState; height: number; frames: number; preview: string | null };
export type LongEnding = "copy" | "save" | "cancel";

export function listenLongStarted(handler: EventCallback<string>) {
  return listen<string>(SCREENSHOT_LONG_EVENT, handler);
}

export function listenLongProgress(handler: EventCallback<LongProgress>) {
  return listen<LongProgress>(SCREENSHOT_LONG_PROGRESS_EVENT, handler);
}

export function reportLongBar(rect: PixelRect) {
  return invoke<void>("screenshot_long_bar", { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

export function pauseLongShot(paused?: boolean) {
  return invoke<boolean | null>("screenshot_long_pause", { paused: paused ?? null });
}

export function endLongShot(action: LongEnding, save?: SaveTarget) {
  return invoke<void>("screenshot_long_end", { action, folder: save?.folder ?? null, folderName: save?.folderName ?? null });
}

export function findScreenshotWords(rect: PixelRect) {
  return invoke<OcrWord[][]>("screenshot_find_words", { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

export function listenScreenshotSession(handler: EventCallback<ScreenshotSession>) {
  return listen<ScreenshotSession>(SCREENSHOT_SESSION_EVENT, handler);
}

export function listenScreenshotEnded(handler: EventCallback<unknown>) {
  return listen(SCREENSHOT_ENDED_EVENT, handler);
}

export function overlayLabel() {
  return getCurrentWebviewWindow().label;
}

export function announceSelecting(label: string) {
  return emit(SCREENSHOT_SELECTING_EVENT, label);
}

export function listenSelecting(handler: EventCallback<string>) {
  return listen<string>(SCREENSHOT_SELECTING_EVENT, handler);
}

export type PinInfo = { width: number; height: number };

export function getPinInfo() {
  return invoke<PinInfo | null>("screenshot_pin_info");
}

export function listenPinAssigned(handler: EventCallback<PinInfo>) {
  return listen<PinInfo>(PIN_ASSIGNED_EVENT, handler);
}

export function getPinImage() {
  return invoke<ArrayBuffer>("screenshot_pin_image");
}

export function pinReady() {
  return invoke<void>("screenshot_pin_ready");
}

export function zoomPin(scale: number, anchor: { x: number; y: number }) {
  return invoke<void>("screenshot_pin_zoom", { scale, anchorX: anchor.x, anchorY: anchor.y });
}

export function setPinClickThrough(through: boolean) {
  return invoke<void>("screenshot_pin_click_through", { through });
}

export function copyPin() {
  return invoke<void>("screenshot_pin_copy");
}

export function savePin(target: SaveTarget) {
  return invoke<string>("screenshot_pin_save", { folder: target.folder ?? null, folderName: target.folderName });
}

export function closePin() {
  return invoke<void>("screenshot_pin_close");
}

export function togglePins() {
  return invoke<void>("screenshot_pins_toggle");
}

export function closeAllPins() {
  return invoke<void>("screenshot_pins_close_all");
}

export function listenScreenshotText(handler: EventCallback<string>) {
  return listen<string>(SCREENSHOT_TEXT_EVENT, handler);
}

export type ScreenshotTaken = {
  path: string;
  thumbnail: string | null;
  saved: boolean;
};

export function listenScreenshotTaken(handler: EventCallback<ScreenshotTaken>) {
  return listen<ScreenshotTaken>(SCREENSHOT_TAKEN_EVENT, handler);
}

export const SCREENSHOT_HISTORY_EVENT = "screenshot-history-changed";

export type HistoryItem = { path: string; takenAt: number; thumbnail: string | null };

export function getScreenshotHistory() {
  return invoke<HistoryItem[]>("screenshot_history");
}

export function copyHistoryScreenshot(path: string) {
  return invoke<void>("screenshot_history_copy", { path });
}

export function pinHistoryScreenshot(path: string) {
  return invoke<void>("screenshot_history_pin", { path });
}

export function deleteHistoryScreenshot(path: string) {
  return invoke<void>("screenshot_history_delete", { path });
}

export function listenScreenshotHistory(handler: () => void) {
  return Promise.all([listen(SCREENSHOT_HISTORY_EVENT, handler), listen(SCREENSHOT_TAKEN_EVENT, handler)])
    .then((stops) => () => stops.forEach((stop) => stop()));
}

export function dragScreenshot(path: string) {
  return invoke<void>("screenshot_drag", { path });
}

export function pasteScreenshotToFront(path: string) {
  return invoke<void>("screenshot_paste_to_front", { path });
}


export type RecordingArea = { x: number; y: number; width: number; height: number };

export type RecordingSummary = {
  path: string;
  width: number;
  height: number;
  seconds: number;
  frames: number;
  repeats: number;
  dropped: number;
  hardware: boolean;
};

export function startRecording(area: RecordingArea, folderName: string, fps?: number) {
  return invoke<string>("screen_recording_start", { ...area, fps, folderName });
}

export function pauseRecording(paused: boolean) {
  return invoke<void>("screen_recording_pause", { paused });
}

export function stopRecording() {
  return invoke<RecordingSummary>("screen_recording_stop");
}
