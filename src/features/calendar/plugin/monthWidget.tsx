import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { WidgetOpenButton } from "../../../components/island-widget/WidgetOpenButton";
import { useLocale, useTranslation } from "../../../i18n";
import { runIslandAction } from "../../plugin-kernel/useIslandContributions";
import { effectiveWeekStart, isRead, startOfDay } from "../monthView.ts";
import { clockTime } from "../upcoming";
import { useCalendarPrefs } from "../useCalendarPrefs";
import { calendarState } from "./islandState";
import { busyDays, dayAgenda, monthGrid, weekdayDates } from "./monthWidgetDays";
import { OPEN_CALENDAR_ACTION } from "./widgets.ts";
import "./monthWidget.css";

const openCalendar = (day?: number) => void runIslandAction(OPEN_CALENDAR_ACTION, day);

export function MonthWidget() {
  const text = useTranslation();
  const t = text.islandWidgets;
  const c = text.calendar;
  const { locale } = useLocale();
  const [prefs] = useCalendarPrefs();
  const calendar = calendarState.use();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const now = calendar?.now ?? Date.now();
  const todayStart = startOfDay(now);
  const selected = picked ?? todayStart;
  const sundayFirst = effectiveWeekStart(prefs.weekStartsOn, locale) === "sunday";
  const grid = useMemo(() => monthGrid(todayStart, offset, sundayFirst), [todayStart, offset, sundayFirst]);
  const events = calendar?.snapshot.events;
  const busy = useMemo(() => busyDays(events ?? [], grid.days[0], grid.days[grid.days.length - 1] + 86_400_000 + 3_600_000), [events, grid]);
  const agenda = useMemo(() => dayAgenda(events ?? [], selected, now), [events, selected, now]);
  const weekdays = useMemo(() => weekdayDates(sundayFirst).map((date) => date.toLocaleDateString(locale, { weekday: "narrow" })), [locale, sundayFirst]);
  const first = new Date(grid.year, grid.month, 1);
  const known = calendar ? isRead(calendar.snapshot, selected) : false;
  const head = agenda[0];
  const pick = (day: number) => {
    if (day === selected) return openCalendar(day);
    setPicked(day === todayStart ? null : day);
    const date = new Date(day);
    if (date.getMonth() !== grid.month) setOffset((value) => value + (date.getTime() < first.getTime() ? -1 : 1));
  };
  const backToToday = () => {
    setOffset(0);
    setPicked(null);
  };
  const away = offset !== 0 || picked !== null;
  return (
    <div className="island-widget month-widget">
      <div className="month-widget__head">
        <button className="month-widget__month" type="button" disabled={!away} title={away ? c.backToToday : undefined} onClick={clickOnly(backToToday)}>
          {first.toLocaleDateString(locale, { month: "long" })}
        </button>
        <span className="month-widget__muted">{grid.year}</span>
        <span className="month-widget__muted month-widget__count">
          {selected === todayStart ? t.content.eventsToday(agenda.length) : c.dayTitle(new Date(selected))}
        </span>
        <span className="month-widget__nav">
          <button type="button" aria-label={c.previousMonth} title={c.previousMonth} onClick={clickOnly(() => setOffset((value) => value - 1))}>
            <ChevronLeft size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button type="button" aria-label={c.nextMonth} title={c.nextMonth} onClick={clickOnly(() => setOffset((value) => value + 1))}>
            <ChevronRight size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <WidgetOpenButton label={c.openPage} onOpen={() => openCalendar(picked ?? undefined)} />
        </span>
      </div>
      <div className="month-widget__grid">
        {weekdays.map((name, at) => (
          <b key={at}>{name}</b>
        ))}
        {grid.days.map((day) => {
          const date = new Date(day);
          const label = c.dayTitle(date);
          return (
            <button
              key={day}
              type="button"
              data-out={date.getMonth() !== grid.month || undefined}
              data-today={day === todayStart || undefined}
              data-selected={(day === selected && picked !== null) || undefined}
              data-busy={busy.has(day) || undefined}
              aria-pressed={day === selected}
              aria-label={day === selected ? c.openDay(label) : label}
              onClick={clickOnly(() => pick(day))}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <button className="month-widget__next" type="button" title={known ? c.openPage : c.notRead} onClick={clickOnly(() => openCalendar(picked ?? undefined))}>
        <i aria-hidden="true" data-empty={!head || undefined} />
        {head ? (
          <>
            <span className="month-widget__time">{head.allDay ? t.content.allDay : clockTime(head.startMs)}</span>
            <span className="month-widget__title">{head.title}</span>
            {agenda.length > 1 ? <span className="month-widget__more">+{agenda.length - 1}</span> : null}
          </>
        ) : (
          <span className="month-widget__title month-widget__none">{c.nothing}</span>
        )}
      </button>
    </div>
  );
}
