import { useEffect, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { getDeviceUse, type DeviceUse } from "./api";
import { sameDeviceUse } from "./deviceUse";

const POLL_MS = 2000;

export const NO_DEVICE_USE: DeviceUse = { camera: [], microphone: [] };

export function useDeviceUse(): DeviceUse {
  const [deviceUse, setDeviceUse] = useState<DeviceUse>(NO_DEVICE_USE);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const reply = await getDeviceUse();
        const next = Array.isArray(reply?.camera) && Array.isArray(reply?.microphone) ? reply : NO_DEVICE_USE;
        if (!cancelled) setDeviceUse((current) => (sameDeviceUse(current, next) ? current : next));
      } catch (error) {
        console.error("Failed to read camera and microphone use", error);
      }
    };
    void refresh();
    const stop = visibilityInterval(() => void refresh(), POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return deviceUse;
}
