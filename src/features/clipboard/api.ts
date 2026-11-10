import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

// 与 src-tauri/src/clipboard_history/mod.rs 中的同名结构对应。
export type ClipboardHistorySettings = {
  enabled: boolean;
  captureImages: boolean;
  maxItems: number;
  shortcut: string;
  shortcutEnabled: boolean;
  /** Where the shortcut opens the history (C22): its own window, or the island's page. */
  openIn: ClipboardOpenIn;
  popupPosition: ClipboardPopupPosition;
  /** The list alone, or with the picked entry beside it; missing before. */
  popupLayout?: ClipboardPopupLayout;
  /** Picking an entry in the window pastes it into the window that was in front. */
  autoPaste: boolean;
  /** An image pasted into a terminal goes as its file path (Claude Code takes it as an image). */
  terminalImagePath: boolean;
  /** Entries older than this many days go, favourites aside; 0 keeps them. */
  retentionDays: number;
  /** Skips what password managers mark as not for clipboard history. */
  skipSensitive: boolean;
  /** Win+V opens the history instead of Windows' own (C22.3). */
  winV: boolean;
  /** Text that looks like a key or token (C24.1). */
  secrets: ClipboardSecretHandling;
  /** Lower-case executable names whose copies are not recorded (C24.2). */
  excludedApps: string[];
  captureFiles: boolean;
  captureHtml: boolean;
  /** Reads the text in images with Windows' OCR (C24.9). */
  ocr: boolean;
  /** Keeps the clipboard window out of screen sharing (C38); missing before. */
  hideFromCapture?: boolean;
  /** Reads a copied link's title and icon, visiting the address (C38). */
  linkPreview?: boolean;
  /** A command copied over several lines goes into a terminal as one line (C38). */
  flattenTerminalCommands?: boolean;
  /** The local API's GET /v1/clipboard may read the history (C38). */
  localApiRead?: boolean;
  /** The user's own prompts for "Rewrite with AI" (C43); missing before. */
  aiPrompts?: ClipboardAiPrompt[];
};

/** A prompt of the user's own for the clipboard window's AI rewrites (C43). */
export type ClipboardAiPrompt = { id: string; title: string; prompt: string };

/** Whether copies are recorded right now (C38). */
export type ClipboardCaptureStatus = { paused: boolean; pausedUntil?: number | null; ignoreNext: boolean };

export type ClipboardSecretHandling = "mask" | "skip" | "keep";

/** The program an entry was copied from (C24.2). */
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
  /** The text as HTML, pasted with its formatting (C24.4). */
  html?: string;
  /** A files entry's paths (C24.3). */
  files?: string[];
  source?: ClipboardSource;
  tags?: string[];
  /** Text Windows' OCR read in the image (C24.9). */
  ocrText?: string;
  /** Looks like a key: the preview is masked (C24.1). */
  masked?: boolean;
};

export type ClipboardHistorySnapshot = {
  settings: ClipboardHistorySettings;
  items: ClipboardHistoryItem[];
  /** Saved texts for pasting again (C24.6); missing before. */
  snippets?: ClipboardSnippet[];
  /** Paused or skipping the next copy (C38); missing before. */
  capture?: ClipboardCaptureStatus;
};

/** A saved text; {date}, {time}, {datetime}, {weekday} and {clipboard} are filled in on paste. */
export type ClipboardSnippet = { id: string; title: string; text: string };

// 与 clipboard_history/mod.rs 中的 HISTORY_CHANGED_EVENT、clipboard_history/hotkey.rs 中的 HOTKEY_EVENT 一致。
export const CLIPBOARD_HISTORY_CHANGED_EVENT = "clipboard-history-changed";
export const CLIPBOARD_HISTORY_SHORTCUT_EVENT = "clipboard-history-shortcut";
// 与 clipboard_history/hotkey.rs 中的 HOTKEY_STATUS_EVENT 一致；载荷为注册错误，成功或关闭时为 null。
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

/** How an image goes back (C22.1): as copied, as its saved file, or as its quoted path (for terminals). */
export type ClipboardCopyAs = "original" | "file" | "path" | "plain" | "text" | "textFile";

// copy_clipboard_history_item_as in src-tauri/src/clipboard_history/mod.rs (CopyAs).
export function copyClipboardItem(id: string, copyAs: ClipboardCopyAs = "original") {
  return copyAs === "original"
    ? invoke<ClipboardHistorySnapshot>("copy_clipboard_history_item", { id })
    : invoke<ClipboardHistorySnapshot>("copy_clipboard_history_item_as", { id, copyAs });
}

// The clipboard window (C22.2), src-tauri/src/clipboard_history/popup.rs.
const CLIPBOARD_POPUP_OPENED_EVENT = "clipboard-popup-opened";

/** Copies the entry, closes the window and pastes into the window that was in front. */
export function pasteClipboardItem(id: string, plain = false, options: { enter?: boolean; copyAs?: ClipboardCopyAs } = {}) {
  return invoke<void>("paste_clipboard_history_item", { id, plain, enter: options.enter ?? false, copyAs: options.copyAs ?? null });
}

/** Pastes any text (transformed, merged or edited) like an entry, without adding it (C38). */
export function pasteClipboardText(text: string, enter = false) {
  return invoke<void>("paste_clipboard_text", { text, enter });
}

/** Saves an edited text as a new entry (C38). */
export function addClipboardHistoryText(text: string) {
  return invoke<ClipboardHistorySnapshot>("add_clipboard_history_text", { text });
}

/** Stops recording for `minutes`, or until resumed (C38). */
export function pauseClipboardCapture(minutes: number | null) {
  return invoke<ClipboardHistorySnapshot>("pause_clipboard_capture", { minutes });
}

export function resumeClipboardCapture() {
  return invoke<ClipboardHistorySnapshot>("resume_clipboard_capture");
}

export function ignoreNextClipboardCopy() {
  return invoke<ClipboardHistorySnapshot>("ignore_next_clipboard_copy");
}

/** Windows' own simplified / traditional Chinese conversion (C38). */
export function convertChineseText(text: string, to: "simplified" | "traditional") {
  return invoke<string>("convert_chinese_text", { text, to });
}

/** The text of a QR code in an image entry, or null (C38). */
export function readClipboardImageQr(id: string) {
  return invoke<string | null>("read_clipboard_image_qr", { id });
}

export type ClipboardLinkPreview = { title?: string | null; icon?: string | null };

/** A link's page title and icon; fails while link previews are off (C38). */
export function getClipboardLinkPreview(url: string) {
  return invoke<ClipboardLinkPreview>("get_clipboard_link_preview", { url });
}

/** A program's icon as a PNG data URL (get_agent_host_icon in agent_status), null without one. */
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

/** Pastes the first entry now; each Ctrl+V after it pastes the next one (C24.7). */
export function pasteClipboardSequence(ids: string[]) {
  return invoke<void>("paste_clipboard_sequence", { ids });
}

/** Writes the history and snippets to Downloads; resolves to the file's path (C24.8). */
export function exportClipboardHistory() {
  return invoke<string>("export_clipboard_history");
}

/** Adds what an exported file holds; resolves to how many entries and snippets were new. */
export function importClipboardHistory(content: string) {
  return invoke<{ items: number; snippets: number }>("import_clipboard_history", { content });
}

export function revealExportedFile(path: string) {
  return revealItemInDir(path);
}

/** A larger copy of an image entry for the window's side pane, as a data URL; null otherwise. */
export function getClipboardImagePreview(id: string) {
  return invoke<string | null>("get_clipboard_image_preview", { id });
}

export function hideClipboardPopup() {
  return invoke<void>("hide_clipboard_popup");
}

/** The window was just shown by the shortcut; resolves to the unlisten function. */
export function listenClipboardPopupOpened(handler: () => void) {
  return listen(CLIPBOARD_POPUP_OPENED_EVENT, () => handler());
}

/** The window lost the focus (the user clicked elsewhere); resolves to the unlisten function. */
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

/** Puts the entry deleted last back, within a few seconds of deleting it (C42). */
export function restoreClipboardItem(id: string) {
  return invoke<ClipboardHistorySnapshot>("restore_clipboard_history_item", { id });
}

export function clearClipboardHistory() {
  return invoke<ClipboardHistorySnapshot>("clear_clipboard_history");
}

/** 返回取消订阅函数的 Promise；调用方负责在卸载时取消。 */
export function listenClipboardHistoryChanged(handler: () => void) {
  return listen(CLIPBOARD_HISTORY_CHANGED_EVENT, handler);
}

export function listenClipboardHistoryShortcut(handler: () => void) {
  return listen(CLIPBOARD_HISTORY_SHORTCUT_EVENT, handler);
}

export function listenClipboardShortcutStatus(handler: (error: string | null) => void) {
  return listen<string | null>(CLIPBOARD_SHORTCUT_STATUS_EVENT, (event) => handler(event.payload));
}
