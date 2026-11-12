import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

export function saveThemeFile(fileName: string, content: string) {
  return invoke<string>("save_settings_backup", { fileName, content });
}

export function getWindowsAccentColor() {
  return invoke<string | null>("get_windows_accent_color");
}

export function revealThemeFile(path: string) {
  return revealItemInDir(path);
}
