import { invoke } from "@tauri-apps/api/core";
import type { DeviceKind } from "../../lib/system-permissions/api.ts";

export type { DeviceKind };

export type DeviceUse = Record<DeviceKind, string[]>;

export function getDeviceUse() {
  return invoke<DeviceUse>("get_device_use");
}
