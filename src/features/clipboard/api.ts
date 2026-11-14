import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

export type ClipboardHistorySettings = {
  enabled: boolean;
  captureImages: boolean;
  maxItems: number;
  shortcut: string;
  shortcutEnabled: boolean;
  openIn: ClipboardOpenIn;
  popupPosition: ClipboardPopupPosition;
  popupLayout?: ClipboardPopupLayout;
  autoPaste: boolean;
  terminalImagePath: boolean;
  retentionDays: number;
  skipSensitive: boolean;
  winV: boolean;
  secrets: ClipboardSecretHandling;
  excludedApps: string[];
  captureFiles: boolean;
  captureHtml: boolean;
  ocr: boolean;
  hideFromCapture?: boolean;
  linkPreview?: boolean;
  flattenTerminalCommands?: boolean;
  localApiRead?: boolean;
  aiPrompts?: ClipboardAiPrompt[];
  popupPinned?: boolean;
  popupPinX?: number | null;
  popupPinY?: number | null;
};

export type ClipboardAiPrompt = { id: string; title: string; prompt: string };

export type ClipboardCaptureStatus = { paused: boolean; pausedUntil?: number | null; ignoreNext: boolean };

export type ClipboardSecretHandling = "mask" | "skip" | "keep";

export type ClipboardSource = { path: string; name: string };

export type ClipboardOpenIn = "window" | "island";
export type ClipboardPopupPosition = "cursor" | "center";
export type ClipboardPopupLayout = "standard" | "wide";

export type ClipboardHistoryImage = {
  width: number;
  height: number;
  byteSize: number;
  originalPath: string;
  thumbnailPath: string;
  thumbnailDataUrl?: string;
};

export type ClipboardFileImage = {
  width: number;
  height: number;
  byteSize: number;
  thumbnailDataUrl: string;
};

export type ClipboardHistoryItem = {
  id: string;
  kind: "text" | "image" | "files";
  hash: string;
  createdAt: number;
  copiedAt: number;
  favorite?: boolean;
  note?: string;
  preview: string;
  text?: string;
  image?: ClipboardHistoryImage;
  html?: string;
  files?: string[];
  fileImage?: ClipboardFileImage;
  source?: ClipboardSource;
  tags?: string[];
  ocrText?: string;
  masked?: boolean;
};

export type ClipboardHistorySnapshot = {
  settings: ClipboardHistorySettings;
  items: ClipboardHistoryItem[];
  snippets?: ClipboardSnippet[];
  capture?: ClipboardCaptureStatus;
};

export type ClipboardSnippet = { id: string; title: string; text: string };

export const CLIPBOARD_HISTORY_CHANGED_EVENT = "clipboard-history-changed";
export const CLIPBOARD_HISTORY_SHORTCUT_EVENT = "clipboard-history-shortcut";
export const CLIPBOARD_SHORTCUT_STATUS_EVENT = "clipboard-history-shortcut-status";

export function getClipboardHistory() {
  return invoke<ClipboardHistorySnapshot>("get_clipboard_history");
}

export function getClipboardShortcutError() {
  return invoke<string | null>("get_clipboard_shortcut_error");
}

export function setClipboardHistorySettings(settings: ClipboardHistorySettings) {
  return invoke<ClipboardHistorySnapshot>("set_clipboard_history_settings", { settings });
}

export type ClipboardCopyAs = "original" | "file" | "path" | "plain" | "text" | "textFile";

export function copyClipboardItem(id: string, copyAs: ClipboardCopyAs = "original") {
  return copyAs === "original"
    ? invoke<ClipboardHistorySnapshot>("copy_clipboard_history_item", { id })
    : invoke<ClipboardHistorySnapshot>("copy_clipboard_history_item_as", { id, copyAs });
}

const CLIPBOARD_POPUP_OPENED_EVENT = "clipboard-popup-opened";

export function pasteClipboardItem(id: string, plain = false, options: { enter?: boolean; copyAs?: ClipboardCopyAs } = {}) {
  return invoke<void>("paste_clipboard_history_item", { id, plain, enter: options.enter ?? false, copyAs: options.copyAs ?? null });
}

export function pasteClipboardText(text: string, enter = false) {
  return invoke<void>("paste_clipboard_text", { text, enter });
}

export function addClipboardHistoryText(text: string) {
  return invoke<ClipboardHistorySnapshot>("add_clipboard_history_text", { text });
}

export function pauseClipboardCapture(minutes: number | null) {
  return invoke<ClipboardHistorySnapshot>("pause_clipboard_capture", { minutes });
}

export function resumeClipboardCapture() {
  return invoke<ClipboardHistorySnapshot>("resume_clipboard_capture");
}

export function ignoreNextClipboardCopy() {
  return invoke<ClipboardHistorySnapshot>("ignore_next_clipboard_copy");
}

export function convertChineseText(text: string, to: "simplified" | "traditional") {
  return invoke<string>("convert_chinese_text", { text, to });
}

export function readClipboardImageQr(id: string) {
  return invoke<string | null>("read_clipboard_image_qr", { id });
}

export type ClipboardLinkPreview = { title?: string | null; icon?: string | null };

export function getClipboardLinkPreview(url: string) {
  return invoke<ClipboardLinkPreview>("get_clipboard_link_preview", { url });
}

export function getAppIcon(path: string) {
  return invoke<string | null>("get_agent_host_icon", { path });
}

export function saveClipboardSnippet(id: string | null, title: string, text: string) {
  return invoke<ClipboardHistorySnapshot>("save_clipboard_snippet", { id, title, text });
}

export function deleteClipboardSnippet(id: string) {
  return invoke<ClipboardHistorySnapshot>("delete_clipboard_snippet", { id });
}

export function pasteClipboardSnippet(id: string) {
  return invoke<void>("paste_clipboard_snippet", { id });
}

export function pasteClipboardSequence(ids: string[]) {
  return invoke<void>("paste_clipboard_sequence", { ids });
}

export function exportClipboardHistory() {
  return invoke<string>("export_clipboard_history");
}

export function importClipboardHistory(content: string) {
  return invoke<{ items: number; snippets: number }>("import_clipboard_history", { content });
}

export function revealExportedFile(path: string) {
  return revealItemInDir(path);
}

export function getClipboardImagePreview(id: string) {
  return invoke<string | null>("get_clipboard_image_preview", { id });
}

export function startClipboardDrag(id: string) {
  return invoke<void>("start_clipboard_drag", { id });
}

export function hideClipboardPopup(blurred = false) {
  return invoke<void>("hide_clipboard_popup", { blurred });
}

export function setClipboardPopupPin(pinned: boolean | null = null) {
  return invoke<ClipboardHistorySnapshot>("set_clipboard_popup_pin", { pinned });
}

export function listenClipboardPopupMoved(handler: () => void) {
  return getCurrentWindow().onMoved(() => handler());
}

export function listenClipboardPopupOpened(handler: () => void) {
  return listen(CLIPBOARD_POPUP_OPENED_EVENT, () => handler());
}

export function listenClipboardPopupBlur(handler: () => void) {
  return getCurrentWindow().onFocusChanged(({ payload: focused }) => {
    if (!focused) handler();
  });
}

export function toggleClipboardFavorite(id: string) {
  return invoke<ClipboardHistorySnapshot>("toggle_clipboard_history_favorite", { id });
}

export function setClipboardItemNote(id: string, note: string) {
  return invoke<ClipboardHistorySnapshot>("set_clipboard_history_item_note", { id, note });
}

export function deleteClipboardItem(id: string) {
  return invoke<ClipboardHistorySnapshot>("delete_clipboard_history_item", { id });
}

export function restoreClipboardItem(id: string) {
  return invoke<ClipboardHistorySnapshot>("restore_clipboard_history_item", { id });
}

export function clearClipboardHistory() {
  return invoke<ClipboardHistorySnapshot>("clear_clipboard_history");
}

export function listenClipboardHistoryChanged(handler: () => void) {
  return listen(CLIPBOARD_HISTORY_CHANGED_EVENT, handler);
}

export function listenClipboardHistoryShortcut(handler: () => void) {
  return listen(CLIPBOARD_HISTORY_SHORTCUT_EVENT, handler);
}

export function listenClipboardShortcutStatus(handler: (error: string | null) => void) {
  return listen<string | null>(CLIPBOARD_SHORTCUT_STATUS_EVENT, (event) => handler(event.payload));
}

export const SHORTCUT_CAPTURED_EVENT = "shortcut-captured";

export function setShortcutCapture(enabled: boolean) {
  return invoke<void>("set_shortcut_capture", { enabled });
}

export function listenShortcutCaptured(handler: (shortcut: string) => void) {
  return listen<string>(SHORTCUT_CAPTURED_EVENT, ({ payload }) => handler(payload));
}
