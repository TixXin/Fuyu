import { Camera, Mic } from "lucide-react";
import { useTranslation } from "../../i18n";
import { openDevicePrivacySettings, type DeviceUse } from "./api";
import { devicesInUse } from "./deviceUse";
import "./DeviceUseIndicator.css";

export function DeviceUseIndicator({ deviceUse }: { deviceUse: DeviceUse }) {
  const t = useTranslation();
  const devices = devicesInUse(deviceUse);
  if (devices.length === 0) return null;

  return (
    <span className="device-use">
      {devices.map((device) => {
        const Icon = device === "camera" ? Camera : Mic;
        return (
          <button
            key={device}
            className={`device-use__button device-use__button--${device}`}
            type="button"
            aria-label={t.island.deviceInUse[device](deviceUse[device].filter(Boolean).join(t.island.deviceAppSeparator))}
            onClick={(event) => {
              event.stopPropagation();
              void openDevicePrivacySettings(device).catch((error: unknown) =>
                console.error("Failed to open the privacy settings", error),
              );
            }}
          >
            <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
          </button>
        );
      })}
    </span>
  );
}
