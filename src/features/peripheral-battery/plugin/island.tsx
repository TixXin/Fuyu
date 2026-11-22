import { defineSlot, type IslandCollapsedMeta } from "../../plugin-kernel/slots";
import { PERIPHERAL_BATTERY_CHIP_WIDTH, PeripheralBatteryChip } from "../PeripheralBatteryChip";
import { PERIPHERAL_BATTERY_HINT, PERIPHERAL_BATTERY_ITEM } from "./islandState";

type GaugeContext = { hints: ReadonlySet<string> };

const gaugeSlot = defineSlot<GaugeContext, IslandCollapsedMeta<GaugeContext>>("island.collapsed/v1");

gaugeSlot.add({
  id: PERIPHERAL_BATTERY_ITEM,
  order: 75,
  group: "gauges",
  width: PERIPHERAL_BATTERY_CHIP_WIDTH,
  hideable: true,
  label: (t) => t.islandWidgets.widgets.peripherals,
  shown: ({ hints }) => hints.has(PERIPHERAL_BATTERY_HINT),
  component: PeripheralBatteryChip,
});
