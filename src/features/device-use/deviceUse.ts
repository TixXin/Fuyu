import type { DeviceKind, DeviceUse } from "./api";

export function sameDeviceUse(a: DeviceUse, b: DeviceUse) {
  return a.camera.join("\n") === b.camera.join("\n") && a.microphone.join("\n") === b.microphone.join("\n");
}

export function devicesInUse(deviceUse: DeviceUse): DeviceKind[] {
  return (["camera", "microphone"] as const).filter((device) => deviceUse[device].length > 0);
}
