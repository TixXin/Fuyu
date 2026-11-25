import { BatteryCharging, BatteryFull } from "lucide-react";
import { useTranslation } from "../../i18n";
import { batteryChipText } from "./batteryPrefs";
import { useSystemStats } from "./statsStore";
import { useBatteryPrefs } from "./useBatteryPrefs";
import "./batteryDetails.css";

export const BATTERY_CHIP_WIDTH = 56;

export function BatteryChip() {
  const i18n = useTranslation();
  const bt = i18n.islandWidgets.system.battery;
  const battery = useSystemStats().stats?.battery ?? null;
  const [prefs] = useBatteryPrefs();
  if (!battery) return null;
  const text = batteryChipText(battery, prefs.collapsedMode);
  if (!text) return null;
  const Icon = battery.pluggedIn ? BatteryCharging : BatteryFull;
  const low = !battery.pluggedIn && typeof battery.level === "number" && battery.level <= 20;
  const minutes = battery.pluggedIn ? battery.timeToFullMinutes : battery.remainingMinutes;
  const extra = minutes ? (battery.pluggedIn ? bt.fullIn(bt.duration(minutes)) : bt.remaining(bt.duration(minutes))) : "";
  const label = [typeof battery.level === "number" ? `${i18n.islandWidgets.widgets.battery} ${battery.level}%` : i18n.islandWidgets.widgets.battery, extra].filter(Boolean).join(" · ");
  return (
    <span
      className="battery-chip"
      role="img"
      aria-label={label}
      title={label}
      data-low={low || undefined}
      data-charging={battery.charging || undefined}
    >
      <Icon size={11} strokeWidth={2.4} aria-hidden="true" />
      <span className="battery-chip__text">{text}</span>
    </span>
  );
}
