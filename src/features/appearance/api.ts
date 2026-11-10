import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

/**
 * Saves a theme file to the Downloads folder (never overwriting); resolves to the file's path.
 * Settings backups and theme files share the command, which checks the name and content.
 */
export function saveThemeFile(fileName: string, content: string) {
  return invoke<string>("save_settings_backup", { fileName, content });
}

/** The Windows accent colour as #rrggbb (src-tauri/src/system/accent_color.rs), or null. */
export function getWindowsAccentColor() {
  return invoke<string | null>("get_windows_accent_color");
}

/** Shows a saved theme file in Explorer. */
export function revealThemeFile(path: string) {
  return revealItemInDir(path);
}
