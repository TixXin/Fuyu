import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

export const SYNC_CATEGORIES = ["todos", "snippets", "links", "settings", "presets", "clipFavorites"] as const;

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

export type SyncBackendKind = "off" | "folder" | "webdav";

export type SyncPhase =
  | "off"
  | "idle"
  | "syncing"
  | "folderMissing"
  | "needsConfirm"
  | "newerVersion"
  | "locked"
  | "error";

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

export type WebdavSummary = {
  url: string;
  username: string;
  hasPassword: boolean;
};

export type EncryptionState = "off" | "unlocked" | "locked";

export type EncryptionSummary = {
  state: EncryptionState;
  hasLocalKey: boolean;
  keyId: string | null;
};

export type SyncStatus = {
  phase: SyncPhase;
  backend?: SyncBackendKind;
  folder: string | null;
  webdav?: WebdavSummary | null;
  encryption?: EncryptionSummary;
  deviceId: string | null;
  lastSyncAt: number | null;
  lastError: string | null;
  error?: unknown;
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

export function setSyncWebdav(input: {
  url: string;
  username: string;
  password: string | null;
  categories: SyncCategory[];
  optionalGroups: OptionalSyncGroup[];
}) {
  return invoke<SyncStatus>("set_sync_webdav", input);
}

export function testSyncWebdav(url: string, username: string, password: string | null) {
  return invoke<void>("test_sync_webdav", { url, username, password });
}

export function stopSync(forgetWebdav = false) {
  return invoke<SyncStatus>("stop_sync", { forgetWebdav });
}

export function syncNow() {
  return invoke<void>("sync_now");
}

export function confirmSyncDeletions() {
  return invoke<void>("confirm_sync_deletions");
}

export function enableSyncEncryption(passphrase: string) {
  return invoke<SyncStatus>("enable_sync_encryption", { passphrase });
}

export function unlockSyncEncryption(secret: string) {
  return invoke<SyncStatus>("unlock_sync_encryption", { secret });
}

export function changeSyncPassphrase(currentSecret: string, newPassphrase: string) {
  return invoke<SyncStatus>("change_sync_passphrase", { currentSecret, newPassphrase });
}

export function disableSyncEncryption(secret: string) {
  return invoke<SyncStatus>("disable_sync_encryption", { secret });
}

export function copySyncRecoveryKey() {
  return invoke<void>("copy_sync_recovery_key");
}

export function saveSyncRecoveryKey() {
  return invoke<string>("save_sync_recovery_key");
}

export function resetSyncRemote(passphrase: string | null) {
  return invoke<SyncStatus>("reset_sync_remote", { passphrase });
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
