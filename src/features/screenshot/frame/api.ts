import { invoke } from "@tauri-apps/api/core";
import type { ScreenshotSession } from "../api";
import { createFramePrefetcher } from "../framePrefetch";

export function getScreenshotSession() {
  return invoke<ScreenshotSession | null>("screenshot_session");
}

export function getScreenshotFrame() {
  return invoke<ArrayBuffer>("screenshot_frame");
}

const framePrefetcher = createFramePrefetcher<ScreenshotSession>({
  getSession: getScreenshotSession,
  getFrame: getScreenshotFrame,
});

export function prefetchScreenshot() {
  framePrefetcher.prefetch();
}

export function resetPrefetchedScreenshot() {
  framePrefetcher.reset();
}

export function peekReadySession() {
  return framePrefetcher.peekSession();
}

export function peekReadyFrame(id: number, width: number, height: number) {
  return framePrefetcher.peekFrame(id, width, height);
}

export function fetchScreenshotSession() {
  return framePrefetcher.fetchSession();
}

export function fetchScreenshotFrame(id: number, width: number, height: number) {
  return framePrefetcher.fetchFrame(id, width, height);
}
