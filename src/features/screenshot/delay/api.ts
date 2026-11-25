import { invoke } from "@tauri-apps/api/core";
import { listen, type EventCallback } from "@tauri-apps/api/event";

export const SCREENSHOT_DELAY_STATE_EVENT = "screenshot-delay-state";

export type ScreenshotDelayState = {
  active: boolean;
  remaining: number;
  total: number;
};

export function startDelayedScreenshot(seconds?: number) {
  return invoke<void>("screenshot_start_delayed", { seconds: seconds ?? null });
}

export function cancelDelayedScreenshot() {
  return invoke<boolean>("screenshot_cancel_delay");
}

export function getDelayedScreenshotStatus() {
  return invoke<ScreenshotDelayState>("screenshot_delay_status");
}

export function listenDelayedScreenshotState(handler: EventCallback<ScreenshotDelayState>) {
  return listen<ScreenshotDelayState>(SCREENSHOT_DELAY_STATE_EVENT, handler);
}
