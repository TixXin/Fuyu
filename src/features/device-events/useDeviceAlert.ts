import { useEffect, useRef, useState } from "react";
import { listenDeviceAlerts, setDeviceAlertsEnabled, type DeviceAlert } from "./api";

export const DEVICE_ALERT_MS = 3000;

export function useDeviceAlert(watch: boolean, show: boolean): DeviceAlert | null {
  const [alert, setAlert] = useState<DeviceAlert | null>(null);
  const showRef = useRef(show);
  showRef.current = show;

  useEffect(() => {
    void setDeviceAlertsEnabled(watch).catch((error: unknown) => console.error("Failed to switch the device watcher", error));
    if (!watch) {
      setAlert(null);
      return;
    }
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenDeviceAlerts((next) => {
      if (showRef.current) setAlert(next);
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for device alerts", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [watch]);

  useEffect(() => {
    if (!show) setAlert(null);
  }, [show]);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), DEVICE_ALERT_MS);
    return () => window.clearTimeout(timer);
  }, [alert]);

  return alert;
}
