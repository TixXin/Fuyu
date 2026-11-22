import { Headphones, Keyboard, Mouse, Speaker, Touchpad, type LucideIcon } from "lucide-react";
import type { BatteryDeviceKind, PeripheralBattery } from "./api";

export const LOW_PERIPHERAL_BATTERY = 20;

const ICONS: Record<BatteryDeviceKind, LucideIcon> = {
  headphones: Headphones,
  headset: Headphones,
  speaker: Speaker,
  mouse: Mouse,
  keyboard: Keyboard,
  trackpad: Touchpad,
};

export function batteryIcon(kind: BatteryDeviceKind): LucideIcon {
  const icon: LucideIcon | undefined = ICONS[kind];
  return icon ?? Headphones;
}

export function lowestBattery(list: readonly PeripheralBattery[]): PeripheralBattery | null {
  let lowest: PeripheralBattery | null = null;
  for (const item of list) if (!lowest || item.battery < lowest.battery) lowest = item;
  return lowest;
}

export function isLowBattery(level: number) {
  return level <= LOW_PERIPHERAL_BATTERY;
}
