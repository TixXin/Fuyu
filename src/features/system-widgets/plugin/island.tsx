import { defineSlot, type IslandCollapsedMeta } from "../../plugin-kernel/slots";
import { BATTERY_CHIP_WIDTH, BatteryChip } from "../BatteryChip";
import { BATTERY_HINT, BATTERY_ITEM } from "./islandState";

type GaugeContext = { hints: ReadonlySet<string> };

const gaugeSlot = defineSlot<GaugeContext, IslandCollapsedMeta<GaugeContext>>("island.collapsed/v1");

gaugeSlot.add({
  id: BATTERY_ITEM,
  order: 74,
  group: "gauges",
  width: BATTERY_CHIP_WIDTH,
  hideable: true,
  label: (t) => t.islandWidgets.widgets.battery,
  shown: ({ hints }) => hints.has(BATTERY_HINT),
  component: BatteryChip,
});
