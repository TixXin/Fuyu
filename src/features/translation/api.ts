import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type EventCallback } from "@tauri-apps/api/event";
import type { TranslationProvider } from "./providers";
import type { Direction } from "./storage";

export const TRANSLATION_WINDOW_OPENED_EVENT = "translation-window-opened";
export const TRANSLATION_SELECTION_EVENT = "translation-selection";
export const TRANSLATION_ISLAND_SHORTCUT_EVENT = "translation-island-shortcut";

export type TranslationService = {
  provider: TranslationProvider;
  baseUrl: string | null;
  model: string | null;
};

export function hasTranslationSecret(provider: TranslationProvider) {
  return invoke<boolean>("has_translation_secret", { provider });
}

export function setTranslationEnabled(enabled: boolean) {
  return invoke("set_translation_enabled", { enabled });
}

export function setTranslationTarget(island: boolean) {
  return invoke("set_translation_target", { island });
}

export function setTranslationShortcut(shortcut: string) {
  return invoke<string>("set_translation_shortcut", { shortcut });
}

export function setTranslationSelectionShortcut(shortcut: string) {
  return invoke<string>("set_translation_selection_shortcut", { shortcut });
}

export function readTranslationClipboard() {
  return invoke<string | null>("read_translation_clipboard");
}

export function translateText(text: string, direction: Direction, service: TranslationService) {
  return invoke<string>("translate_text", { text, direction, ...service });
}

export function saveTranslationSecret(secret: string, provider: TranslationProvider) {
  return invoke("save_translation_secret", { secret, provider });
}

export function deleteTranslationSecret(provider: TranslationProvider) {
  return invoke("delete_translation_secret", { provider });
}

export function copyTranslationResult(text: string) {
  return invoke("copy_translation_result", { text });
}

export function hideTranslationWindow() {
  return invoke("hide_translation_window");
}

export function listenTranslationWindowOpened(handler: EventCallback<unknown>) {
  return listen(TRANSLATION_WINDOW_OPENED_EVENT, handler);
}

export function toggleTranslationWindow() {
  return invoke("toggle_translation_window");
}

export function presentTranslationWindow() {
  return invoke("present_translation_window");
}

export function listenTranslationSelection(handler: EventCallback<string>) {
  return listen<string>(TRANSLATION_SELECTION_EVENT, handler);
}

export function listenTranslationIslandShortcut(handler: EventCallback<unknown>) {
  return listen(TRANSLATION_ISLAND_SHORTCUT_EVENT, handler);
}

export type RewriteTask = "summarize" | "polish" | "grammar" | "translate" | "custom";

export function rewriteText(text: string, task: RewriteTask, service: TranslationService, options: { prompt?: string; onChunk?: (piece: string) => void } = {}) {
  const onChunk = new Channel<string>(options.onChunk);
  return invoke<string>("rewrite_text", { text, task, prompt: options.prompt ?? null, ...service, onChunk });
}
