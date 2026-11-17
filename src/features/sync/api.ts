import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

export const SYNC_CATEGORIES = ["todos", "snippets", "links", "settings", "presets"] as const;

export type SyncCategory = (typeof SYNC_CATEGORIES)[number];

export const OPTIONAL_SYNC_GROUPS = [
  "agentPushDelivery",
  "agentSoundOutput",
  "collapsedItems",
  "pluginPages",
  "qqMail",
  "screenshotCapture",
  "translationProvider",
  "updateChannel",
] as const;

export type OptionalSyncGroup = (typeof OPTIONAL_SYNC_GROUPS)[number];

export type SyncPhase = "off" | "idle" | "syncing" | "folderMissing" | "needsConfirm" | "newerVersion" | "error";

export type CategoryState = "off" | "waiting" | "ok" | "notReady" | "newerVersion" | "needsConfirm" | "error";

export type CategoryStatus = {
  category: SyncCategory;
  state: CategoryState;
  message: string | null;
  lastSyncAt: number | null;
};

export type ConfirmReason = "manyDeletions" | "remoteCleared";

export type SyncConfirm = {
  reason: ConfirmReason;
  category: SyncCategory | null;
  removed: number;
  total: number;
};

export type SyncDevice = {
  deviceId: string;
  name: string;
  platform: string;
  appVersion: string;
  lastSyncAt: number;
  thisDevice: boolean;
};

export type SyncStatus = {
  phase: SyncPhase;
  folder: string | null;
  deviceId: string | null;
  lastSyncAt: number | null;
  lastError: string | null;
  confirm: SyncConfirm | null;
  categories: CategoryStatus[];
  optionalGroups: OptionalSyncGroup[];
  devices: SyncDevice[];
  skippedFiles: string[];
};

export const SYNC_STATUS_EVENT = "sync-status-changed";

export function getSyncStatus() {
  return invoke<SyncStatus>("get_sync_status");
}

export function setSyncConfig(folder: string | null, categories: SyncCategory[], optionalGroups: OptionalSyncGroup[]) {
  return invoke<SyncStatus>("set_sync_config", { folder, categories, optionalGroups });
}

export function syncNow() {
  return invoke<void>("sync_now");
}

export function confirmSyncDeletions() {
  return invoke<void>("confirm_sync_deletions");
}

export function onSyncStatus(handler: (status: SyncStatus) => void): Promise<UnlistenFn> {
  return listen<SyncStatus>(SYNC_STATUS_EVENT, (event) => handler(event.payload));
}

export async function pickSyncFolder(title: string): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, title });
  return typeof picked === "string" ? picked : null;
}

export function revealSyncFolder(path: string): Promise<void> {
  return revealItemInDir(path);
}
