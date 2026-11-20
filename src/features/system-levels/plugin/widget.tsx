import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { LevelsWidget } from "./levelsWidget";
import { LEVELS_WIDGET } from "./widgets.ts";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

widgetSlot.add({ ...LEVELS_WIDGET, component: LevelsWidget }, LEVELS_WIDGET.owner);
