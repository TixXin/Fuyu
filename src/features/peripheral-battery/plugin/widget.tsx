import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { PeripheralBatteryWidget } from "../PeripheralBatteryWidget";
import { PERIPHERAL_BATTERY_WIDGET } from "./widgets.ts";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

widgetSlot.add({ ...PERIPHERAL_BATTERY_WIDGET, component: PeripheralBatteryWidget });
