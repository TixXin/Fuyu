import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

export function saveSettingsBackup(fileName: string, content: string) {
  return invoke<string>("save_settings_backup", { fileName, content });
}

export function restartIsland() {
  return invoke<void>("restart_island");
}

export function readSettingsFile() {
  return invoke<string | null>("read_settings_file");
}

export function writeSettingsFile(text: string) {
  return invoke<void>("write_settings_file", { text });
}

export function revealBackup(path: string) {
  return revealItemInDir(path);
}
