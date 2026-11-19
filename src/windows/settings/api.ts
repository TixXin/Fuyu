import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { requestSettingsFocus, type SettingsFocusSection } from "./storage";

export function settingsWindowOpening(section?: SettingsFocusSection): Promise<void> {
  if (section) {
    requestSettingsFocus(section);
  }

  return invoke<void>("open_settings_window").catch((error) => {
    console.error("Failed to open settings window", error);
  });
}

export function openSettingsWindow(section?: SettingsFocusSection) {
  void settingsWindowOpening(section);
}

export function openPluginSettingsWindow(plugin: string): Promise<void> {
  requestSettingsFocus("pluginsV3", plugin);
  return invoke<void>("open_settings_window");
}

export function showSettingsWindow() {
  return invoke("show_settings_window");
}

const SETTINGS_WINDOW_REOPENED_EVENT = "settings-window-reopened";

export function listenSettingsWindowReopened(onReopened: () => void) {
  return listen(SETTINGS_WINDOW_REOPENED_EVENT, onReopened);
}

export type DevPriority = "releaseFirst" | "devFirst";

export type DevPriorityState = { priority: DevPriority; yielding: boolean; releaseRunning: boolean; releaseYields?: boolean };

const DEV_PRIORITY_CHANGED_EVENT = "dev-priority-changed";

export function readDevPriority() {
  return invoke<DevPriorityState | null>("get_dev_priority");
}

export function saveDevPriority(priority: DevPriority) {
  return invoke<DevPriorityState | null>("set_dev_priority", { priority });
}

export function listenDevPriorityChanged(onState: (state: DevPriorityState) => void) {
  return listen<DevPriorityState>(DEV_PRIORITY_CHANGED_EVENT, ({ payload }) => onState(payload));
}

export function readLaunchAtStartup() {
  return invoke<boolean>("get_launch_at_startup");
}

export function saveLaunchAtStartup(enabled: boolean) {
  return invoke("set_launch_at_startup", { enabled });
}

export function quitIsland() {
  return invoke<void>("quit_island");
}

export function readTrayIconVisible() {
  return invoke<boolean>("get_tray_icon_visible");
}

export function saveTrayIconVisible(visible: boolean) {
  return invoke<void>("set_tray_icon_visible", { visible });
}

export type CrashLogsHome = {
  home: string;
  crashLog?: string | null;
};

export function readCrashLogsHome() {
  return invoke<CrashLogsHome>("get_data_home");
}

export function revealCrashLogPath(path: string) {
  return revealItemInDir(path);
}
