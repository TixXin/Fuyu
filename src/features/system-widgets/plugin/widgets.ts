import { Activity, BatteryFull, Cpu, LayoutGrid } from "lucide-react";
import { BUILTIN } from "@fuyu/plugin-base/client/slots";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";

export const SYSTEM_STATUS_WIDGET: BuiltinWidget = { id: "system-status", icon: Cpu, owner: BUILTIN, group: "system", sizes: ["s"], order: 210, label: (t) => t.islandWidgets.widgets.systemStatus };
export const BATTERY_WIDGET: BuiltinWidget = { id: "battery", icon: BatteryFull, owner: BUILTIN, group: "system", sizes: ["s"], order: 211, label: (t) => t.islandWidgets.widgets.battery };
export const NETWORK_WIDGET: BuiltinWidget = { id: "network", icon: Activity, owner: BUILTIN, group: "system", sizes: ["s"], order: 212, label: (t) => t.islandWidgets.widgets.network };
export const LAUNCHER_WIDGET: BuiltinWidget = { id: "launcher", icon: LayoutGrid, owner: BUILTIN, group: "system", sizes: ["s", "m"], order: 213, label: (t) => t.islandWidgets.widgets.launcher };

export const islandWidgets: readonly BuiltinWidget[] = [SYSTEM_STATUS_WIDGET, BATTERY_WIDGET, NETWORK_WIDGET, LAUNCHER_WIDGET];
