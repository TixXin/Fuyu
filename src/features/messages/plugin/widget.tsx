import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { UnreadWidget } from "./unreadWidget";
import { UNREAD_WIDGET } from "./widgets.ts";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

widgetSlot.add({ ...UNREAD_WIDGET, component: UnreadWidget }, UNREAD_WIDGET.owner);
