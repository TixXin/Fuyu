import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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

export function showSettingsWindow() {
  return invoke("show_settings_window");
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
