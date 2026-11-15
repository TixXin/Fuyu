import { BatteryCharging, BatteryLow, Headphones, Keyboard, Mouse, Speaker, Touchpad, Unplug, type LucideIcon } from "lucide-react";
import type { useTranslation } from "../../i18n";
import type { DeviceAlert, PeripheralKind } from "./api";

const PERIPHERAL_ICONS: Record<PeripheralKind, LucideIcon> = { mouse: Mouse, keyboard: Keyboard, trackpad: Touchpad };
const LOW_BATTERY = 20;

export type DeviceAlertText = ReturnType<typeof useTranslation>["island"]["deviceAlert"];

export function deviceAlertLook(alert: DeviceAlert, text: DeviceAlertText) {
  let Icon: LucideIcon;
  let message: string;
  let tone: "on" | "off" | "warn" | "charge";
  switch (alert.kind) {
    case "audioConnected":
    case "audioDisconnected":
      Icon = alert.device === "speaker" ? Speaker : Headphones;
      message = alert.kind === "audioConnected" ? text.connected(alert.name) : text.disconnected(alert.name);
      tone = alert.kind === "audioConnected" ? "on" : "off";
      break;
    case "peripheralConnected":
      Icon = PERIPHERAL_ICONS[alert.device];
      message = text.connected(alert.name);
      tone = alert.battery <= LOW_BATTERY ? "warn" : "on";
      break;
    case "batteryLow":
      Icon = BatteryLow;
      message = text.batteryLow(alert.name);
      tone = "warn";
      break;
    case "powerConnected":
      Icon = BatteryCharging;
      message = text.charging;
      tone = "charge";
      break;
    case "powerDisconnected":
      Icon = Unplug;
      message = text.unplugged;
      tone = "off";
      break;
  }
  const battery = "battery" in alert ? alert.battery : null;
  const label = battery === null ? message : `${message}, ${text.battery(battery)}`;
  return { Icon, message, tone, battery, label };
}
