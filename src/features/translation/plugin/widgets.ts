import { Languages } from "lucide-react";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const TRANSLATE_WIDGET: BuiltinWidget = { id: "translate", icon: Languages, owner: OWNER, group: "translation", sizes: ["m"], order: 96, label: (t) => t.islandWidgets.widgets.translate };

export const islandWidgets: readonly BuiltinWidget[] = [TRANSLATE_WIDGET];
