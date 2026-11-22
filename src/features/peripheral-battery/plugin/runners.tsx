import { BUILTIN } from "@fuyu/plugin-base/client/slots";
import { isCollapsedItemHidden } from "../../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../../lib/settings/useCollapsedPlacements";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { usePeripheralBatteries } from "../batteryStore";
import { PERIPHERAL_BATTERY_HINT, PERIPHERAL_BATTERY_ITEM } from "./islandState";

const runnerSlot = defineSlot<object>("island.runner/v1");
const NONE: readonly IslandContribution[] = [];
const CHIP: readonly IslandContribution[] = [{ kind: "hint", key: PERIPHERAL_BATTERY_HINT }];

function ChipWatcher() {
  const { list } = usePeripheralBatteries();
  useIslandContributions(BUILTIN, "peripheral-battery.chip", list.length > 0 ? CHIP : NONE);
  return null;
}

function PeripheralBatteryRunner() {
  const { placements } = useCollapsedPlacements();
  const hidden = isCollapsedItemHidden(placements, PERIPHERAL_BATTERY_ITEM);
  return hidden ? null : <ChipWatcher />;
}

runnerSlot.add({ id: "peripheral-battery.chip", component: PeripheralBatteryRunner });
