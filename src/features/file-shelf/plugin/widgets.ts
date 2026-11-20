import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const SHELF_WIDGET: BuiltinWidget = { id: "shelf", owner: OWNER, group: "shelf", sizes: ["bar", "s", "m"], order: 70, label: (t) => t.islandWidgets.widgets.shelf };

export const islandWidgets: readonly BuiltinWidget[] = [SHELF_WIDGET];
