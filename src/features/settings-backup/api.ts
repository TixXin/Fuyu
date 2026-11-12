import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

/** Saves a backup to the Downloads folder (never overwriting); resolves to the file's path. */
export function saveSettingsBackup(fileName: string, content: string) {
  return invoke<string>("save_settings_backup", { fileName, content });
}

/** Restarts the island so settings that are only read at start-up take effect. */
export function restartIsland() {
  return invoke<void>("restart_island");
}

/** settings.json in the island's data folder, or null when there is none (settings_file.rs). */
export function readSettingsFile() {
  return invoke<string | null>("read_settings_file");
}

/** Replaces settings.json with `text`, in the settings backup format. */
export function writeSettingsFile(text: string) {
  return invoke<void>("write_settings_file", { text });
}

/** Shows a saved backup in Explorer. */
export function revealBackup(path: string) {
  return revealItemInDir(path);
}
