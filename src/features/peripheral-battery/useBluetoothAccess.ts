import { useCallback, useEffect, useState } from "react";
import {
  getBluetoothBatteryAccess,
  openBluetoothPrivacySettings,
  requestBluetoothBatteryAccess,
  type BluetoothBatteryAccess,
} from "./api";
import { refreshPeripheralBatteries } from "./batteryStore";

export function knownAccess(value: unknown): BluetoothBatteryAccess {
  return value === "notDetermined" || value === "denied" || value === "allowed" ? value : "unsupported";
}

export function useBluetoothAccess() {
  const [access, setAccess] = useState<BluetoothBatteryAccess>("unsupported");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let alive = true;
    void getBluetoothBatteryAccess()
      .then((value) => {
        if (alive) setAccess(knownAccess(value));
      })
      .catch((failure: unknown) => console.error("Failed to read Bluetooth access", failure));
    return () => {
      alive = false;
    };
  }, []);

  const request = useCallback(() => {
    setAsking(true);
    void requestBluetoothBatteryAccess()
      .then((value) => {
        const next = knownAccess(value);
        setAccess(next);
        if (next === "allowed") refreshPeripheralBatteries();
      })
      .catch((failure: unknown) => console.error("Failed to ask for Bluetooth access", failure))
      .finally(() => setAsking(false));
  }, []);

  const openSettings = useCallback(() => {
    void openBluetoothPrivacySettings().catch((failure: unknown) => console.error("Failed to open Bluetooth privacy settings", failure));
  }, []);

  return { access, asking, request, openSettings };
}
