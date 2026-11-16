import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const SHORTCUT_CAPTURED_EVENT = "shortcut-captured";

export function setShortcutCapture(enabled: boolean) {
  return invoke<void>("set_shortcut_capture", { enabled });
}

export function listenShortcutCaptured(handler: (shortcut: string) => void) {
  return listen<string>(SHORTCUT_CAPTURED_EVENT, ({ payload }) => handler(payload));
}
