import { readJson, writeJson } from "../storage.ts";
import { normalizeWhatsNewState, type SettingsWhatsNewState } from "./whatsNew.ts";

export const SETTINGS_WHATS_NEW_STORAGE_KEY = "fuyu-settings-whats-new";

export function readWhatsNewState(): SettingsWhatsNewState | null {
  return normalizeWhatsNewState(readJson(SETTINGS_WHATS_NEW_STORAGE_KEY));
}

export function writeWhatsNewState(state: SettingsWhatsNewState): boolean {
  return writeJson(SETTINGS_WHATS_NEW_STORAGE_KEY, state);
}
