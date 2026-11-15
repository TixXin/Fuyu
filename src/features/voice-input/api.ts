import { invoke } from "@tauri-apps/api/core";
import { listen, type EventCallback } from "@tauri-apps/api/event";
import type { NativeError } from "../../i18n/nativeError";

export const VOICE_INPUT_STATE_EVENT = "voice-input-state";
export const VOICE_INPUT_SHORTCUT_EVENT = "voice-input-shortcut-status";
export const VOICE_INPUT_MODEL_PROGRESS_EVENT = "voice-input-model-progress";

export type VoiceInputState =
  | { phase: "idle" }
  | { phase: "recording"; startedAtMs: number; limitSeconds: number }
  | { phase: "transcribing" }
  | { phase: "result"; text: string }
  | { phase: "failed"; error: NativeError };

export type VoiceShortcutProblem = "invalid" | "taken";

export type VoiceModelStatus = {
  installed: boolean;
  supported: boolean;
  downloading: boolean;
  sizeBytes: number;
  downloadBytes: number;
};

export type VoiceModelProgress = {
  stage: "download" | "unpack" | "done";
  downloaded: number;
  total: number;
  source: string;
};

export function getVoiceInputState() {
  return invoke<VoiceInputState>("voice_input_state");
}

export function configureVoiceInput(enabled: boolean, shortcut: string) {
  return invoke<void>("voice_input_configure", { enabled, shortcut });
}

export function getVoiceShortcutProblem() {
  return invoke<VoiceShortcutProblem | null>("voice_input_shortcut_problem");
}

export function toggleVoiceInput() {
  return invoke<void>("voice_input_toggle");
}

export function cancelVoiceInput() {
  return invoke<void>("voice_input_cancel");
}

export function getVoiceModelStatus() {
  return invoke<VoiceModelStatus>("voice_input_model_status");
}

export function downloadVoiceModel() {
  return invoke<VoiceModelStatus>("voice_input_download_model");
}

export function cancelVoiceModelDownload() {
  return invoke<void>("voice_input_cancel_download");
}

export function deleteVoiceModel() {
  return invoke<VoiceModelStatus>("voice_input_delete_model");
}

export function listenVoiceInputState(handler: EventCallback<VoiceInputState>) {
  return listen<VoiceInputState>(VOICE_INPUT_STATE_EVENT, handler);
}

export function listenVoiceShortcutProblem(handler: EventCallback<VoiceShortcutProblem | null>) {
  return listen<VoiceShortcutProblem | null>(VOICE_INPUT_SHORTCUT_EVENT, handler);
}

export function listenVoiceModelProgress(handler: EventCallback<VoiceModelProgress>) {
  return listen<VoiceModelProgress>(VOICE_INPUT_MODEL_PROGRESS_EVENT, handler);
}
