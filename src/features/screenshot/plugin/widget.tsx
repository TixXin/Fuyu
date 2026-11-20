import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { RecentScreenshotWidget } from "./recentWidget";
import { RECENT_SCREENSHOT_WIDGET } from "./widgets.ts";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

widgetSlot.add({ ...RECENT_SCREENSHOT_WIDGET, component: RecentScreenshotWidget }, RECENT_SCREENSHOT_WIDGET.owner);
