import { useTranslation } from "../../i18n";
import { batteryIcon, isLowBattery, lowestBattery } from "./batteryLook";
import { usePeripheralBatteries } from "./batteryStore";
import "./peripheralBattery.css";

export const PERIPHERAL_BATTERY_CHIP_WIDTH = 50;

export function PeripheralBatteryChip() {
  const t = useTranslation().islandWidgets;
  const lowest = lowestBattery(usePeripheralBatteries().list);
  if (!lowest) return null;
  const Icon = batteryIcon(lowest.kind);
  const label = t.content.peripheralLevel(lowest.name, lowest.battery);
  return (
    <span className="peripheral-battery-chip" role="img" aria-label={label} title={label} data-low={isLowBattery(lowest.battery) || undefined}>
      <Icon size={11} strokeWidth={2.4} aria-hidden="true" />
      <span className="peripheral-battery-chip__level">{lowest.battery}%</span>
    </span>
  );
}
