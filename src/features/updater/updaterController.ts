import { isNativeError } from "../../i18n/nativeError.ts";
import { isTauri } from "@tauri-apps/api/core";
import {
  checkUpdate, downloadAndInstallUpdate, downloadUpdate, getAppVersion, getNativeUpdateState, isNetworkMetered, getUpdaterProxy,
  isUpdaterConfigured, listenUpdateState, notifyUpdate, type UpdateSnapshot,
} from "./api";
import { nextUpdateCheckAt } from "./checkSchedule";
import {
  CHANNEL_KEY, UPDATE_PREFERENCES_KEY, loadUpdateChannel, loadUpdatePreferences,
  normalizeCheckInterval, saveUpdateChannel, saveUpdatePreferences,
  type AutoUpdateMode, type UpdateChannel, type UpdatePreferences, type UpdateReminderMode,
} from "./storage";

export type UpdateStage = UpdateSnapshot["stage"] | "disabled";
export type UpdateState = Omit<UpdateSnapshot, "stage" | "channel"> & UpdatePreferences & {
  stage: UpdateStage;
  version: string;
  channel: UpdateChannel;
  nextCheckAt: number | null;
  notificationUnavailable: boolean;
  commandError: unknown;
};

let state: UpdateState = {
  ...loadUpdatePreferences(), revision: -1, stage: "idle", version: "", channel: "stable",
  nextVersion: "", notes: "", downloaded: 0, total: 0, detail: "",
  lastAttemptAt: null, startedAt: 0, checkFailures: 0, nextCheckAt: null,
  notificationUnavailable: false, commandError: null,
};
const listeners = new Set<() => void>();
let proxy: string | null = null;
let ready: Promise<void> | null = null;
let commandRunning = false;
let disposed = false;
let stopNativeListener: (() => void) | undefined;

function setState(patch: Partial<UpdateState>) {
  const next = { ...state, ...patch };
  state = { ...next, nextCheckAt: nextUpdateCheckAt(next) };
  for (const listener of listeners) listener();
}

export function subscribeToUpdate(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getUpdateState() { return state; }

export function reminderVersion(current: UpdateState) {
  return current.nextVersion && current.nextVersion !== current.skippedVersion
    && !["downloading", "installing", "done", "disabled"].includes(current.stage)
    ? current.nextVersion : null;
}

function busy(stage: UpdateStage) {
  return stage === "checking" || stage === "downloading" || stage === "installing";
}

export function applyUpdateSnapshot(snapshot: UpdateSnapshot) {
  if (disposed || snapshot.revision <= state.revision) return;
  const preferences = loadUpdatePreferences();
  if (snapshot.lastCheckedAt !== null && preferences.lastCheckedAt !== snapshot.lastCheckedAt) {
    saveUpdatePreferences({ lastCheckedAt: snapshot.lastCheckedAt });
  }
  setState({
    ...snapshot,
    channel: snapshot.channel ?? loadUpdateChannel(state.version),
    lastCheckedAt: snapshot.lastCheckedAt ?? preferences.lastCheckedAt,
    commandError: null,
  });
}

function initialize() {
  ready ??= loadBuildInfo();
  return ready;
}

async function loadBuildInfo() {
  reloadPreferences();
  if (!isTauri()) { setState({ stage: "disabled" }); return; }
  try {
    const [version, configured] = await Promise.all([getAppVersion(), isUpdaterConfigured()]);
    setState({ version, channel: loadUpdateChannel(version), stage: configured ? state.stage : "disabled" });
    if (!configured) return;
    proxy = await getUpdaterProxy().catch(() => null);
    const unlisten = await listenUpdateState(applyUpdateSnapshot);
    if (disposed) { unlisten(); return; }
    stopNativeListener = unlisten;
    applyUpdateSnapshot(await getNativeUpdateState());
  } catch (error) {
    setState({ stage: "error", commandError: error });
  }
}

export function reloadPreferences() {
  const preferences = loadUpdatePreferences();
  setState({ ...preferences, channel: loadUpdateChannel(state.version) });
}

export async function checkOnFirstVisit() {
  await initialize();
  if (state.stage === "idle" && state.nextCheckAt !== null && state.nextCheckAt <= Date.now()) await checkForUpdate();
}

export async function checkInBackground() {
  await initialize();
  reloadPreferences();
  if (state.nextCheckAt === null || state.nextCheckAt > Date.now()) return false;
  return checkForUpdate();
}

function isBusyError(error: unknown) {
  return isNativeError(error) && error.code === "updater.busy";
}

export async function checkForUpdate(requestedChannel?: UpdateChannel) {
  await initialize();
  const channel = requestedChannel ?? loadUpdateChannel(state.version);
  if (commandRunning || busy(state.stage) || ["disabled", "done"].includes(state.stage)) return false;
  commandRunning = true;
  setState({ commandError: null });
  let success = false;
  let failure: unknown = null;
  try {
    await checkUpdate(channel, proxy);
    success = true;
  } catch (error) { failure = error; }
  try { applyUpdateSnapshot(await getNativeUpdateState()); }
  catch (error) {
    setState({ stage: "error", startedAt: state.startedAt || Date.now(), lastAttemptAt: Date.now(), checkFailures: state.checkFailures + 1 });
    failure ??= error;
  }
  commandRunning = false;
  if (failure && !busy(state.stage) && !isBusyError(failure)) setState({ commandError: failure });
  return success;
}

export async function setUpdateChannel(channel: UpdateChannel) {
  await initialize();
  if (busy(state.stage) || commandRunning || channel === state.channel) return;
  if (await checkForUpdate(channel)) {
    saveUpdateChannel(channel);
    setState({ channel });
  }
}

export function setAutoCheck(autoCheck: boolean) {
  setState(saveUpdatePreferences({ autoCheck }));
}
export function setCheckInterval(hours: number) {
  setState(saveUpdatePreferences({ checkIntervalHours: normalizeCheckInterval(hours) }));
}
export function setReminderMode(reminderMode: UpdateReminderMode) {
  setState(saveUpdatePreferences({ reminderMode, notificationUnavailable: false }));
}
export function skipVersion(version: string | null) {
  setState(saveUpdatePreferences({ skippedVersion: version }));
}
export function setAutoUpdate(autoUpdate: AutoUpdateMode) {
  setState(saveUpdatePreferences({ autoUpdate }));
}

const downloadTried = new Set<string>();
let backgroundDownloadRunning = false;

export async function downloadInBackground() {
  if (backgroundDownloadRunning) return false;
  backgroundDownloadRunning = true;
  try {
    return await downloadOnce();
  } finally {
    backgroundDownloadRunning = false;
  }
}

async function downloadOnce() {
  await initialize();
  reloadPreferences();
  const version = state.nextVersion;
  const key = `${state.channel}:${version}`;
  if (state.autoUpdate === "off" || state.stage !== "available" || !version || version === state.skippedVersion
    || commandRunning || downloadTried.has(key)) return false;
  if (await isNetworkMetered().catch(() => false)) return false;
  downloadTried.add(key);
  try {
    await downloadUpdate(version, state.channel);
  } catch {
  }
  try { applyUpdateSnapshot(await getNativeUpdateState()); } catch {}
  return getUpdateState().stage === "ready";
}

export async function notifyAvailableUpdate(title: string, body: (version: string) => string) {
  reloadPreferences();
  const version = reminderVersion(state);
  const key = `${state.channel}:${version}`;
  if (!state.autoCheck || state.reminderMode !== "notification" || !version || state.lastNotifiedKey === key) return;
  const shown = await notifyUpdate(version, title, body(version)).catch(() => false);
  if (shown) setState(saveUpdatePreferences({ lastNotifiedKey: key, notificationUnavailable: false }));
  else setState(saveUpdatePreferences({ notificationUnavailable: true }));
}

export async function installUpdate(expectedVersion?: string, expectedChannel?: UpdateChannel) {
  await initialize();
  if (!state.nextVersion || busy(state.stage) || commandRunning || state.stage === "done") return;
  commandRunning = true;
  const nextVersion = expectedVersion ?? state.nextVersion;
  const channel = expectedChannel ?? state.channel;
  setState({ commandError: null });
  let failure: unknown = null;
  try { await downloadAndInstallUpdate(nextVersion, channel); }
  catch (error) { failure = error; }
  try { applyUpdateSnapshot(await getNativeUpdateState()); }
  catch (error) { failure ??= error; }
  commandRunning = false;
  if (failure && !busy(state.stage) && !isBusyError(failure)) setState({ commandError: failure });
}

function syncPreferences(event: StorageEvent) {
  if (event.key === null || event.key === UPDATE_PREFERENCES_KEY || event.key === CHANNEL_KEY) reloadPreferences();
}
function dispose() {
  disposed = true;
  stopNativeListener?.();
  window.removeEventListener("storage", syncPreferences);
  window.removeEventListener("pagehide", dispose);
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", syncPreferences);
  window.addEventListener("pagehide", dispose);
}
void initialize();
