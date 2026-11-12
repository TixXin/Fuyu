import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type AudioDeviceKind = "headphones" | "headset" | "speaker";

export type DeviceAlert =
  | { kind: "audioConnected"; name: string; device: AudioDeviceKind; battery: number | null }
  | { kind: "audioDisconnected"; name: string; device: AudioDeviceKind }
  | { kind: "batteryLow"; name: string; battery: number }
  | { kind: "powerConnected"; battery: number | null }
  | { kind: "powerDisconnected"; battery: number | null };

export function setDeviceAlertsEnabled(enabled: boolean) {
  return invoke<void>("set_device_alerts_enabled", { enabled });
}

export function listenDeviceAlerts(onAlert: (alert: DeviceAlert) => void) {
  return listen<DeviceAlert>("device-alert", (event) => onAlert(event.payload));
}
