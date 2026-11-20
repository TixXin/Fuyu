import { Timer } from "lucide-react";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const TIMER_WIDGET: BuiltinWidget = { id: "timer", icon: Timer, owner: OWNER, group: "timer", sizes: ["bar", "s"], order: 80, label: (t) => t.islandWidgets.widgets.timer };

export const islandWidgets: readonly BuiltinWidget[] = [TIMER_WIDGET];
