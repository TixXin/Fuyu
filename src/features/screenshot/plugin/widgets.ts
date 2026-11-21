import { Scissors } from "lucide-react";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const RECENT_SCREENSHOT_WIDGET: BuiltinWidget = { id: "screenshot-recent", icon: Scissors, owner: OWNER, group: "screenshot", sizes: ["s", "m"], order: 95, label: (t) => t.islandWidgets.widgets.screenshot };

export const islandWidgets: readonly BuiltinWidget[] = [RECENT_SCREENSHOT_WIDGET];
