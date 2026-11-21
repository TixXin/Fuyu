import type { ComponentType } from "react";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { BatteryWidget, LauncherWidget, NetworkWidget, SystemStatusWidget } from "../SystemWidgets";
import { BATTERY_WIDGET, LAUNCHER_WIDGET, NETWORK_WIDGET, SYSTEM_STATUS_WIDGET } from "./widgets.ts";
import "../systemWidgets.css";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

const COMPONENTS: readonly [BuiltinWidget, ComponentType<IslandWidgetProps>][] = [
  [SYSTEM_STATUS_WIDGET, SystemStatusWidget],
  [BATTERY_WIDGET, BatteryWidget],
  [NETWORK_WIDGET, NetworkWidget],
  [LAUNCHER_WIDGET, LauncherWidget],
];

for (const [widget, component] of COMPONENTS) widgetSlot.add({ ...widget, component });
