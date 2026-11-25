import { BUILTIN } from "@fuyu/plugin-base/client/slots";
import { useProvideAbsentWidget } from "../../plugin-kernel/absentWidgets";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useHasBattery } from "../batteryPresence";
import { BATTERY_HINT } from "./islandState";
import { BATTERY_WIDGET } from "./widgets.ts";

const runnerSlot = defineSlot<object>("island.runner/v1");
const CHIP: readonly IslandContribution[] = [{ kind: "hint", key: BATTERY_HINT }];
const NONE: readonly IslandContribution[] = [];

function BatteryPresenceRunner() {
  const hasBattery = useHasBattery();
  useProvideAbsentWidget(BATTERY_WIDGET.id, hasBattery === false);
  useIslandContributions(BUILTIN, "system-widgets.battery-chip", hasBattery === true ? CHIP : NONE);
  return null;
}

runnerSlot.add({ id: "system-widgets.battery-presence", component: BatteryPresenceRunner });
