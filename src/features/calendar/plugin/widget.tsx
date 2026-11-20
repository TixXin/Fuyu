import { CalendarClock } from "lucide-react";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { clockTime } from "../upcoming";
import { calendarState } from "./islandState";
import { MonthWidget } from "./monthWidget";
import { MONTH_WIDGET, NEXT_MEETING_WIDGET } from "./widgets.ts";

const ROW_PX = 22;
const FIRST_PX = 62;

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

function NextMeetingWidget({ height }: IslandWidgetProps) {
  const t = useTranslation().islandWidgets;
  const calendar = calendarState.use();
  const now = calendar?.now ?? Date.now();
  const events = (calendar?.snapshot.events ?? [])
    .filter((event) => event.endMs > now && !event.declined)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startMs - b.startMs)
    .filter((event) => !event.allDay || event.startMs <= now + 86_400_000);
  const timed = events.filter((event) => !event.allDay);
  const next = timed[0] ?? events[0];
  const rest = events.filter((event) => event !== next).slice(0, Math.max(0, Math.floor((height - FIRST_PX) / ROW_PX)));
  const minutes = next ? Math.max(0, Math.round((next.startMs - now) / 60_000)) : 0;
  return (
    <WidgetFrame icon={CalendarClock} title={t.widgets.nextMeeting} aside={next && !next.allDay ? (next.startMs <= now ? t.content.meetingNow : t.content.meetingIn(minutes)) : null}>
      {next ? (
        <>
          <span className="island-widget__headline">{next.title}</span>
          <span className="island-widget__sub">{next.allDay ? t.content.allDay : `${clockTime(next.startMs)}–${clockTime(next.endMs)}`}{next.location ? ` · ${next.location}` : ""}</span>
          {rest.length > 0 ? (
            <ul className="island-widget__list">
              {rest.map((event) => (
                <li key={`${event.uid}-${event.startMs}`} className="island-widget__row">
                  <span className="island-widget__time">{event.allDay ? t.content.allDay : clockTime(event.startMs)}</span>
                  <span>{event.title}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <WidgetEmpty>{t.content.noMeeting}</WidgetEmpty>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...NEXT_MEETING_WIDGET, component: NextMeetingWidget }, NEXT_MEETING_WIDGET.owner);
widgetSlot.add({ ...MONTH_WIDGET, component: MonthWidget }, MONTH_WIDGET.owner);
