import { useEffect, useMemo, useState } from "react";
import { ListTodo, RefreshCcw, Settings, Video } from "lucide-react";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { getLocalDateString } from "../../utils/date";
import type { CalendarEvent, CalendarSnapshot } from "./api";
import { CalendarEmpty } from "./CalendarEmpty";
import { CalendarMonth } from "./CalendarMonth";
import { CalendarTodoInput } from "./CalendarTodoInput";
import { prepareCalendarEvents, resolveCalendarColor } from "./calendarPrefs";
import { joinCalendarMeeting } from "./joinMeeting";
import { chineseDay } from "./lunar.ts";
import { agendaDayStarts, eventsOn, isRead, monthStart, namesTheDay, nextDay, nextSpecialDay, startOfDay } from "./monthView.ts";
import { SCHEDULED_TODO_UID, scheduledTodoEvents } from "./todoEvents";
import { clockTime } from "./upcoming";
import { useCalendarPrefs } from "./useCalendarPrefs";
import "./CalendarPanel.css";

export function CalendarPanel({
  snapshot,
  now,
  onRefresh,
  onOpenSettings,
  todos,
}: {
  snapshot: CalendarSnapshot;
  now: number;
  onRefresh: () => void;
  onOpenSettings: () => void;
  todos?: { scheduled: readonly { id: string; title: string; date: string }[]; onAdd: (title: string, date: string) => void };
}) {
  const t = useTranslation();
  const text = t.calendar;
  const errorText = useErrorText();
  const lunar = useLocale().locale === "zh-CN";
  const [prefs, setPrefs] = useCalendarPrefs();
  const today = startOfDay(now);
  const [picked, setPicked] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [unfoldedDays, setUnfoldedDays] = useState<ReadonlySet<number>>(() => new Set());
  const selected = picked ?? today;
  const shownMonth = month ?? monthStart(selected);
  const todoList = t.island.todoList;
  const scheduled = todos?.scheduled;
  const events = useMemo(() => {
    const merged = scheduled?.length
      ? [...snapshot.events, ...scheduledTodoEvents(scheduled, todoList, prefs.includeTimedTodos)].sort((a, b) => a.startMs - b.startMs)
      : snapshot.events;
    return prepareCalendarEvents(merged, prefs);
  }, [prefs, scheduled, snapshot.events, todoList]);

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  if (snapshot.sourceCount === 0 && snapshot.events.length === 0) {
    return (
      <section className="calendar-panel" aria-label={text.title}>
        <CalendarEmpty onAdded={onRefresh} onOpenSettings={onOpenSettings} />
      </section>
    );
  }

  const select = (day: number) => {
    setPicked(day === today ? null : day);
    setMonth(null);
  };
  const toggleDayFold = (day: number) => {
    setUnfoldedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };
  const subtitle = (day: number) => {
    if (!lunar) return "";
    const chinese = chineseDay(new Date(day));
    const named = chinese.festival ?? chinese.term;
    const coming = day === today && !named ? nextSpecialDay(day) : null;
    return [chinese.lunar, named, coming ? text.daysUntil(coming.name, coming.days) : ""].filter(Boolean).join(" · ");
  };
  const tomorrow = nextDay(today);
  const days = agendaDayStarts(today, selected, prefs.agendaRange).map((day) => ({
    day,
    label: day === today
      ? `${text.today} · ${text.dayTitle(new Date(day))}`
      : day === tomorrow
        ? `${text.tomorrow} · ${text.dayTitle(new Date(tomorrow))}`
        : text.dayTitle(new Date(day)),
  }));
  const sevenDays = prefs.agendaRange === "sevenDays";

  const row = (event: CalendarEvent) => {
    const past = event.endMs <= now;
    const running = event.startMs <= now && now < event.endMs;
    const todo = event.uid.startsWith(SCHEDULED_TODO_UID);
    const time = event.allDay ? (todo ? text.todo : text.allDay) : `${clockTime(event.startMs)}–${clockTime(event.endMs)}`;
    const color = todo ? null : resolveCalendarColor(event.calendar, prefs.calendarColors, snapshot.calendarColors);
    return (
      <li key={`${event.uid}:${event.startMs}`} className={`calendar-event${past ? " calendar-event--past" : ""}${running && !event.allDay ? " calendar-event--now" : ""}${todo ? " calendar-event--todo" : ""}`}>
        <span className="calendar-event__time">{todo && <ListTodo size={12} strokeWidth={2.2} aria-label={text.todo} />}{time}</span>
        <span className="calendar-event__main">
          <span className="calendar-event__title">{event.title || text.untitled}</span>
          <span className="calendar-event__place">
            {color && <span className="calendar-event__dot" style={{ backgroundColor: color }} aria-hidden="true" />}
            {[event.location, event.calendar].filter(Boolean).join(" · ")}
          </span>
        </span>
        {event.meetingLink && !past && (
          <button
            className="calendar-event__join"
            type="button"
            aria-label={text.joinLabel(event.title || text.untitled)}
            onClick={() => joinCalendarMeeting(event.meetingLink!, prefs.pauseMediaOnJoin)}
          >
            <Video size={13} strokeWidth={2.4} aria-hidden="true" />
            {text.join}
          </button>
        )}
      </li>
    );
  };

  return (
    <section className="calendar-panel" aria-label={text.title}>
      <div className="calendar-panel__list">
        <div className="calendar-panel__head">
          <span
            className="calendar-panel__status"
            title={snapshot.problems.length > 0 ? snapshot.problems.map((problem) => errorText(problem.message)).join("\n") : undefined}
          >
            {snapshot.problems.length > 0 ? text.problems(snapshot.problems.length) : snapshot.fetchedAt ? text.updatedAt(clockTime(snapshot.fetchedAt)) : ""}
          </span>
          <button
            className={`calendar-panel__range${sevenDays ? " calendar-panel__range--active" : ""}`}
            type="button"
            aria-pressed={sevenDays}
            aria-label={text.toggleRangeLabel(sevenDays)}
            onClick={() => setPrefs({ ...prefs, agendaRange: sevenDays ? "twoDays" : "sevenDays" })}
          >
            {sevenDays ? text.rangeSevenDays : text.rangeTwoDays}
          </button>
          <button className="calendar-panel__icon" type="button" aria-label={text.refresh} onClick={onRefresh}>
            <RefreshCcw size={14} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button className="calendar-panel__icon" type="button" aria-label={text.openSettings} onClick={onOpenSettings}>
            <Settings size={14} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <div className="calendar-panel__days">
          {days.map(({ day, label }) => {
            const dayEvents = eventsOn(events, day).filter((event) => !namesTheDay(event));
            const allDayEvents = prefs.foldAllDay ? dayEvents.filter((event) => event.allDay) : [];
            const timedEvents = prefs.foldAllDay ? dayEvents.filter((event) => !event.allDay) : [];
            const canFold = prefs.foldAllDay && allDayEvents.length > 1;
            const expanded = unfoldedDays.has(day);
            const read = snapshot.fromMs === 0 || isRead(snapshot, day);
            const sub = subtitle(day);
            const showTodoInput = Boolean(todos) && day >= today && (!sevenDays || day === selected);
            return (
              <div key={day} className="calendar-day">
                <h3 className="calendar-day__label">{label}</h3>
                {sub && <p className="calendar-day__lunar">{sub}</p>}
                {dayEvents.length > 0 ? (
                  <ul className="calendar-day__events">
                    {canFold ? (
                      <>
                        {(expanded ? allDayEvents : [allDayEvents[0]]).map(row)}
                        <li className="calendar-day__fold-item">
                          <button
                            className="calendar-day__fold"
                            type="button"
                            aria-expanded={expanded}
                            onClick={() => toggleDayFold(day)}
                          >
                            {expanded ? text.foldAllDay : text.moreAllDay(allDayEvents.length - 1)}
                          </button>
                        </li>
                        {timedEvents.map(row)}
                      </>
                    ) : (
                      dayEvents.map(row)
                    )}
                  </ul>
                ) : (
                  <p className="calendar-day__empty">{read ? text.nothing : text.notRead}</p>
                )}
                {showTodoInput && <CalendarTodoInput label={label} onAdd={(title) => todos!.onAdd(title, getLocalDateString(new Date(day)))} />}
              </div>
            );
          })}
        </div>
      </div>
      <CalendarMonth
        month={shownMonth}
        today={today}
        selected={selected}
        events={events}
        showWeekNumbers={prefs.showWeekNumbers}
        weekStartsOn={prefs.weekStartsOn}
        onSelect={select}
        onMonth={(delta) => setMonth(monthStart(shownMonth, delta))}
      />
    </section>
  );
}
