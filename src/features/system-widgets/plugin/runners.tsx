import { useProvideAbsentWidget } from "../../plugin-kernel/absentWidgets";
import { defineSlot } from "../../plugin-kernel/slots";
import { useHasBattery } from "../batteryPresence";
import { BATTERY_WIDGET } from "./widgets.ts";

const runnerSlot = defineSlot<object>("island.runner/v1");

function BatteryPresenceRunner() {
  useProvideAbsentWidget(BATTERY_WIDGET.id, useHasBattery() === false);
  return null;
}

runnerSlot.add({ id: "system-widgets.battery-presence", component: BatteryPresenceRunner });
