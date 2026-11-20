import { CalendarClock } from "lucide-react";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const NEXT_MEETING_WIDGET: BuiltinWidget = { id: "next-meeting", icon: CalendarClock, owner: OWNER, group: "calendar", sizes: ["m", "l"], order: 20, label: (t) => t.islandWidgets.widgets.nextMeeting };

export const islandWidgets: readonly BuiltinWidget[] = [NEXT_MEETING_WIDGET];
