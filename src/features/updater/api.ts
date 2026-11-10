import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UpdateChannel } from "./storage";

export function isUpdaterConfigured() {
  return invoke<boolean>("updater_configured");
}

export function getUpdaterProxy() {
  return invoke<string | null>("get_updater_proxy");
}

/** Mirrors UpdateInfo in src-tauri/src/system/update_channel.rs. */
export type UpdateInfo = { version: string; body: string | null };

/** Mirrors the shared native updater snapshot. */
export type UpdateSnapshot = {
  revision: number;
  stage: "idle" | "checking" | "latest" | "available" | "downloading" | "ready" | "installing" | "done" | "error";
  channel: UpdateChannel | null;
  nextVersion: string;
  notes: string;
  downloaded: number;
  total: number;
  detail: string;
  lastCheckedAt: number | null;
  lastAttemptAt: number | null;
  startedAt: number;
  checkFailures: number;
};

export const UPDATE_STATE_EVENT = "updater-state-changed";
export const UPDATE_OPEN_SETTINGS_EVENT = "updater-open-settings";
export function listenUpdateNotificationClick(onOpen: () => void) {
  return listen(UPDATE_OPEN_SETTINGS_EVENT, onOpen);
}
export function getNativeUpdateState() {
  return invoke<UpdateSnapshot>("updater_state");
}
export function listenUpdateState(onState: (state: UpdateSnapshot) => void) {
  return listen<UpdateSnapshot>(UPDATE_STATE_EVENT, ({ payload }) => onState(payload));
}

/** Mirrors DownloadEvent in src-tauri/src/system/update_channel.rs. */
export type DownloadEvent =
  | { event: "Started"; data: { contentLength: number | null } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export function checkUpdate(channel: UpdateChannel, proxy: string | null) {
  return invoke<UpdateInfo | null>("updater_check", { channel, proxy });
}

export function downloadAndInstallUpdate(expectedVersion: string, expectedChannel: UpdateChannel) {
  const channel = new Channel<DownloadEvent>();
  // Runtime events are authoritative; keep the legacy channel contract for the command.
  channel.onmessage = () => {};
  return invoke<void>("updater_install", { onEvent: channel, expectedVersion, expectedChannel });
}

/** Downloads the found update in the background to install later (stage "ready"). */
export function downloadUpdate(expectedVersion: string, expectedChannel: UpdateChannel) {
  return invoke<void>("updater_download", { expectedVersion, expectedChannel });
}

/** Whether the internet connection is metered, roaming or over its limit. */
export function isNetworkMetered() {
  return invoke<boolean>("updater_metered");
}

export function notifyUpdate(version: string, title: string, body: string) {
  return invoke<boolean>("updater_notify", { version, title, body });
}

/** Mirrors the allowlisted diagnostics returned by system's updater_diagnostics. */
export type UpdateDiagnostics = { osVersion: string; architecture: string };
export function getUpdateDiagnostics() {
  return invoke<UpdateDiagnostics>("updater_diagnostics");
}
