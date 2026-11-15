import { readJson, writeJson } from "../../lib/storage.ts";
import { normalizeVoiceInputSettings, type VoiceInputSettings } from "./settings.ts";

export const VOICE_INPUT_SETTINGS_KEY = "fuyu-voice-input";

export function loadVoiceInputSettings(): VoiceInputSettings {
  return normalizeVoiceInputSettings(readJson(VOICE_INPUT_SETTINGS_KEY));
}

export function saveVoiceInputSettings(settings: VoiceInputSettings) {
  writeJson(VOICE_INPUT_SETTINGS_KEY, settings);
}
