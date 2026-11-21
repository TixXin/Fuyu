import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../../features/plugin-kernel/slots.ts";

export const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");
