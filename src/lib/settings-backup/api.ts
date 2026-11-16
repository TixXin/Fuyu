import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { takeSnapshot } from "./localSnapshot.ts";

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

export const SETTINGS_SYNC_APPLIED_EVENT = "settings-sync-applied";

export type SettingsSyncApplied = { keys: Record<string, unknown> };

export function onSettingsSyncApplied(handler: (applied: SettingsSyncApplied) => void): Promise<UnlistenFn> {
  return listen<SettingsSyncApplied>(SETTINGS_SYNC_APPLIED_EVENT, (event) => handler(event.payload));
}

export type DataHomeSource = "env" | "pointer" | "default" | "appData";

export type DataHome = { home: string; defaultHome: string; source: DataHomeSource };

export function getDataHome() {
  return invoke<DataHome>("get_data_home");
}

export function setDataHome(path: string | null) {
  return invoke<string>("set_data_home", { path });
}

export function revealFolder(path: string) {
  return revealItemInDir(path);
}

export function revealBackup(path: string) {
  return revealItemInDir(path);
}

export type UpdateBackup = {
  id: string;
  fromVersion: string;
  toVersion: string;
  createdAt: number;
  size: number;
  files: number;
  skipped: string[];
};

export type UpdateBackupList = {
  backups: UpdateBackup[];
  brokenFiles: string[];
  pendingRestore: string | null;
};

export function backupBeforeUpdate(toVersion: string) {
  const localStorage = JSON.stringify(takeSnapshot(window.localStorage));
  return invoke<UpdateBackup>("update_backup_create", { toVersion, localStorage });
}

export function listUpdateBackups() {
  return invoke<UpdateBackupList>("update_backup_list");
}

export function prepareUpdateBackupRestore(id: string) {
  return invoke<Record<string, string>>("update_backup_restore", { id });
}
