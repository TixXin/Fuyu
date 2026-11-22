import { BatteryMedium } from "lucide-react";
import { BUILTIN } from "@fuyu/plugin-base/client/slots";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";

export const PERIPHERAL_BATTERY_WIDGET: BuiltinWidget = { id: "peripheral-battery", icon: BatteryMedium, owner: BUILTIN, group: "system", sizes: ["s"], order: 215, label: (t) => t.islandWidgets.widgets.peripherals };

export const islandWidgets: readonly BuiltinWidget[] = [PERIPHERAL_BATTERY_WIDGET];
