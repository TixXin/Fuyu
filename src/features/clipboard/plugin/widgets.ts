import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const CLIPBOARD_WIDGET: BuiltinWidget = { id: "clipboard-recent", owner: OWNER, group: "clipboard", sizes: ["m", "l"], order: 60, label: (t) => t.islandWidgets.widgets.clipboard };

export const islandWidgets: readonly BuiltinWidget[] = [CLIPBOARD_WIDGET];
