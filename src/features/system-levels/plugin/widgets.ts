import { SlidersVertical } from "lucide-react";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const LEVELS_WIDGET: BuiltinWidget = { id: "levels", icon: SlidersVertical, owner: OWNER, group: "system", sizes: ["s"], order: 214, label: (t) => t.islandWidgets.widgets.levels };

export const islandWidgets: readonly BuiltinWidget[] = [LEVELS_WIDGET];
