import { invoke } from "@tauri-apps/api/core";

export type DeviceKind = "camera" | "microphone";

export type DeviceUse = Record<DeviceKind, string[]>;

export function getDeviceUse() {
  return invoke<DeviceUse>("get_device_use");
}

export function openDevicePrivacySettings(device: DeviceKind) {
  return invoke<void>("open_device_privacy_settings", { device });
}
