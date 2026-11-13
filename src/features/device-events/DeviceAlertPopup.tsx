import { useTranslation } from "../../i18n";
import type { DeviceAlert } from "./api";
import { deviceAlertLook } from "./deviceAlertLook";
import "./DeviceAlertPopup.css";

export function DeviceAlertPopup({ alert }: { alert: DeviceAlert }) {
  const text = useTranslation().island.deviceAlert;
  const { Icon, message, tone, battery, label } = deviceAlertLook(alert, text);

  return (
    <span className={`device-alert device-alert--${tone}`} role="status" aria-label={label}>
      <Icon className="device-alert__icon" size={16} strokeWidth={2.2} aria-hidden="true" />
      <span className="device-alert__text" aria-hidden="true">{message}</span>
      {battery !== null && <span className="device-alert__battery" aria-hidden="true">{battery}%</span>}
    </span>
  );
}
