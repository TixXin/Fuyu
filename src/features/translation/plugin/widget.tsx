import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { TranslateWidget } from "./translateWidget";
import { TRANSLATE_WIDGET } from "./widgets.ts";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

widgetSlot.add({ ...TRANSLATE_WIDGET, component: TranslateWidget }, TRANSLATE_WIDGET.owner);
