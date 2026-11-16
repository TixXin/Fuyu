import { emit } from "@tauri-apps/api/event";

const CLIPBOARD_POPUP_FIRST_FRAME_EVENT = "clipboard-popup-first-frame";

export type ClipboardPopupFirstFrame = { sinceOpenedMs: number };

export function reportClipboardPopupFirstFrame(frame: ClipboardPopupFirstFrame) {
  return emit(CLIPBOARD_POPUP_FIRST_FRAME_EVENT, frame);
}
