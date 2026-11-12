import { getVersion } from "@tauri-apps/api/app";
import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { UpdateChannel } from "./storage";

export function getAppVersion() {
  return getVersion();
}

export function openProjectLink(url: string) {
  return openUrl(url);
}

export function isUpdaterConfigured() {
  return invoke<boolean>("updater_configured");
}

export function getUpdaterProxy() {
  return invoke<string | null>("get_updater_proxy");
}

export type UpdateInfo = { version: string; body: string | null };

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

export type DownloadEvent =
  | { event: "Started"; data: { contentLength: number | null } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export function checkUpdate(channel: UpdateChannel, proxy: string | null) {
  return invoke<UpdateInfo | null>("updater_check", { channel, proxy });
}

export function downloadAndInstallUpdate(expectedVersion: string, expectedChannel: UpdateChannel) {
  const channel = new Channel<DownloadEvent>();
  channel.onmessage = () => {};
  return invoke<void>("updater_install", { onEvent: channel, expectedVersion, expectedChannel });
}

export function downloadUpdate(expectedVersion: string, expectedChannel: UpdateChannel) {
  return invoke<void>("updater_download", { expectedVersion, expectedChannel });
}

export function isNetworkMetered() {
  return invoke<boolean>("updater_metered");
}

export function notifyUpdate(version: string, title: string, body: string) {
  return invoke<boolean>("updater_notify", { version, title, body });
}

export type UpdateDiagnostics = { osVersion: string; architecture: string };
export function getUpdateDiagnostics() {
  return invoke<UpdateDiagnostics>("updater_diagnostics");
}
