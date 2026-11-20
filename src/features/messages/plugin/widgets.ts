import { MessageCircle } from "lucide-react";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const UNREAD_WIDGET: BuiltinWidget = { id: "unread", icon: MessageCircle, owner: OWNER, group: "messages", sizes: ["s"], order: 90, label: (t) => t.islandWidgets.widgets.unread };

export const islandWidgets: readonly BuiltinWidget[] = [UNREAD_WIDGET];
