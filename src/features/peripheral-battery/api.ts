import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
export type BatteryDeviceKind = "headphones" | "headset" | "speaker" | "mouse" | "keyboard" | "trackpad";

export type PeripheralBattery = {
  id: string;
  name: string;
  kind: BatteryDeviceKind;
  battery: number;
};

export function getPeripheralBatteries() {
  return invoke<PeripheralBattery[]>("get_peripheral_batteries");
}

export function listenPeripheralBatteries(onChange: (list: PeripheralBattery[]) => void) {
  return listen<PeripheralBattery[]>("peripheral-batteries", (event) => onChange(event.payload));
}

export type BluetoothBatteryAccess = "notDetermined" | "denied" | "allowed" | "unsupported";

export function getBluetoothBatteryAccess() {
  return invoke<BluetoothBatteryAccess>("get_bluetooth_battery_access");
}

export function requestBluetoothBatteryAccess() {
  return invoke<BluetoothBatteryAccess>("request_bluetooth_battery_access");
}

export function openBluetoothPrivacySettings() {
  return invoke<void>("open_bluetooth_privacy_settings");
}
