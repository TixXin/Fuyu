import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandAlertMeta } from "../../plugin-kernel/slots";
import type { DeviceAlert } from "../api";
import { deviceAlertLook } from "../deviceAlertLook";
import { DeviceAlertPopup } from "../DeviceAlertPopup";

type AlertSources = { deviceAlert: DeviceAlert | null };

const alertSlot = defineSlot<AlertSources, IslandAlertMeta<AlertSources>>("island.alert/v1");

function DeviceAlertLeading({ deviceAlert }: AlertSources) {
  const t = useTranslation();
  if (!deviceAlert) return null;
  const { Icon, tone } = deviceAlertLook(deviceAlert, t.island.deviceAlert);
  return (
    <span className={`notch-alert__icon device-alert device-alert--${tone}`} aria-hidden="true">
      <Icon className="device-alert__icon" size={16} strokeWidth={2.2} />
    </span>
  );
}

function DeviceAlertTrailing({ deviceAlert }: AlertSources) {
  const t = useTranslation();
  if (!deviceAlert) return null;
  const { tone, battery, label } = deviceAlertLook(deviceAlert, t.island.deviceAlert);
  return (
    <span className={`notch-alert__value device-alert device-alert--${tone}`} role="status" aria-label={label}>
      <span className={battery === null ? "device-alert__text" : "device-alert__battery"} aria-hidden="true">
        {battery === null ? deviceAlert.kind === "powerConnected" || deviceAlert.kind === "powerDisconnected" ? "" : deviceAlert.name : `${battery}%`}
      </span>
    </span>
  );
}

function DeviceAlertBody({ deviceAlert }: AlertSources) {
  return deviceAlert ? <DeviceAlertPopup alert={deviceAlert} /> : null;
}

alertSlot.add({ id: "device", order: 10, component: DeviceAlertLeading, trailing: DeviceAlertTrailing, popup: DeviceAlertBody });
