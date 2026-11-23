import { CalendarClock, Video } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { WidgetOpenButton } from "../../../components/island-widget/WidgetOpenButton";
import { useTranslation } from "../../../i18n";
import { runIslandAction } from "../../plugin-kernel/useIslandContributions";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { joinCalendarMeeting } from "../joinMeeting";
import { startOfDay } from "../monthView.ts";
import { clockTime } from "../upcoming";
import { useCalendarPrefs } from "../useCalendarPrefs";
import { calendarState } from "./islandState";
import { MonthWidget } from "./monthWidget";
import { MONTH_WIDGET, NEXT_MEETING_WIDGET, OPEN_CALENDAR_ACTION } from "./widgets.ts";
import "./widget.css";

const ROW_PX = 22;
const FIRST_PX = 62;

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

const openCalendar = (at?: number) => void runIslandAction(OPEN_CALENDAR_ACTION, at === undefined ? undefined : startOfDay(at));

function NextMeetingWidget({ height }: IslandWidgetProps) {
  const text = useTranslation();
  const t = text.islandWidgets;
  const [prefs] = useCalendarPrefs();
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
  const link = next?.meetingLink?.trim();
  const countdown = next && !next.allDay ? (next.startMs <= now ? t.content.meetingNow : t.content.meetingIn(minutes)) : null;
  const aside = (
    <>
      {countdown}
      <WidgetOpenButton label={text.calendar.openPage} onOpen={() => openCalendar()} />
    </>
  );
  return (
    <WidgetFrame icon={CalendarClock} title={t.widgets.nextMeeting} aside={aside} className="meeting-widget">
      {next ? (
        <>
          <div className="meeting-widget__first">
            <button className="meeting-widget__open" type="button" title={text.calendar.openPage} onClick={clickOnly(() => openCalendar(next.startMs))}>
              <span className="island-widget__headline">{next.title}</span>
              <span className="island-widget__sub">{next.allDay ? t.content.allDay : `${clockTime(next.startMs)}–${clockTime(next.endMs)}`}{next.location ? ` · ${next.location}` : ""}</span>
            </button>
            {link ? (
              <button className="meeting-widget__join" type="button" aria-label={text.calendar.joinLabel(next.title)} title={text.calendar.joinLabel(next.title)} onClick={clickOnly(() => joinCalendarMeeting(link, prefs.pauseMediaOnJoin))}>
                <Video size={12} strokeWidth={2.2} aria-hidden="true" />
                <span>{text.calendar.join}</span>
              </button>
            ) : null}
          </div>
          {rest.length > 0 ? (
            <ul className="island-widget__list">
              {rest.map((event) => (
                <li key={`${event.uid}-${event.startMs}`}>
                  <button className="island-widget__row meeting-widget__row" type="button" onClick={clickOnly(() => openCalendar(event.startMs))}>
                    <span className="island-widget__time">{event.allDay ? t.content.allDay : clockTime(event.startMs)}</span>
                    <span>{event.title}</span>
                  </button>
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
